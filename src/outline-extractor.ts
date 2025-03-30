import * as fs from 'fs-extra';
import pdfjsLib from './pdfjs-config';
import { OutlineItem, OutlineResult, OutlineSource, PdfProcessOptions } from './types';

/**
 * 从PDF书签提取目录结构
 * @param pdfDocument PDF文档对象
 * @returns 目录项数组
 */
export async function extractOutlineFromBookmarks(pdfDocument: any): Promise<OutlineItem[]> {
  try {
    const outline = await pdfDocument.getOutline();
    
    if (!outline || outline.length === 0) {
      console.log('未找到书签结构');
      return [];
    }
    
    // 处理目录项，提取页码信息
    const processedOutline: OutlineItem[] = [];
    
    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];
      if (item.dest !== null && item.dest !== undefined) {
        let destRef;
        
        try {
          if (Array.isArray(item.dest)) {
            destRef = item.dest[0];
          } else {
            const dest = await pdfDocument.getDestination(item.dest);
            if (dest && dest.length > 0) {
              destRef = dest[0];
            } else {
              console.warn(`跳过目录项 "${item.title}"，无效的目标引用`);
              continue;
            }
          }
          
          const pageNumber = await pdfDocument.getPageIndex(destRef) + 1;
          
          processedOutline.push({
            title: item.title,
            pageNumber: pageNumber,
            level: 1 // 假设顶级章节
          });
        } catch (err) {
          console.warn(`无法解析目录项 "${item.title}" 的页码信息: ${(err as Error).message}`);
        }
      }
    }
    
    // 按页码排序
    processedOutline.sort((a, b) => a.pageNumber - b.pageNumber);
    
    return processedOutline;
  } catch (error) {
    console.error('提取PDF书签结构时出错:', error);
    return [];
  }
}

/**
 * 查找目录页
 * 通过扫描PDF的前几页内容，寻找含有"目录"、"Contents"等关键词的页面
 * @param pdfDocument PDF文档对象
 * @param maxScanPages 最大扫描页数
 * @returns 目录页索引，如未找到则返回-1
 */
export async function findTableOfContentsPage(pdfDocument: any, maxScanPages: number): Promise<number> {
  // 目录页特征关键词
  const tocKeywords = ['目录', '目 录', 'contents', 'table of contents', 'catalog'];
  // 目录项特征：通常包含多个"......"或点线加页码
  const tocItemPatterns = [
    /\.{3,}\s*\d+/,  // ....... 123
    /\d+\s*\.{3,}/,  // 123 .......
    /第.+章.+\d+/,   // 第X章XXXX 123
    /\d+\.\s*.+\d+$/  // 1. 章节名 123
  ];
  
  const numPages = pdfDocument.numPages;
  // 只扫描前几页
  const pagesToScan = Math.min(maxScanPages, numPages);
  
  console.log(`开始扫描前${pagesToScan}页查找目录页...`);
  
  for (let i = 1; i <= pagesToScan; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
    
    // 检查是否包含目录关键词
    const hasKeyword = tocKeywords.some(keyword => text.includes(keyword.toLowerCase()));
    
    // 检查是否包含目录项特征
    const hasPattern = tocItemPatterns.some(pattern => pattern.test(text));
    
    // 检查是否有多个页码引用（通常目录页会引用多个页码）
    const pageNumbers = text.match(/\b\d{1,3}\b/g) || [];
    const hasMultiplePageRefs = pageNumbers.length >= 3; // 至少有3个数字可能是页码
    
    if ((hasKeyword && hasPattern) || (hasPattern && hasMultiplePageRefs)) {
      console.log(`在第${i}页找到疑似目录页`);
      return i;
    }
  }
  
  console.log('未找到目录页');
  return -1;
}

/**
 * 从目录页提取章节和页码信息
 * @param pdfDocument PDF文档对象
 * @param tocPageIndex 目录页索引
 * @returns 提取的目录项数组
 */
export async function extractTocFromPage(pdfDocument: any, tocPageIndex: number): Promise<OutlineItem[]> {
  console.log(`从第${tocPageIndex}页提取目录内容...`);
  
  const outline: OutlineItem[] = [];
  const tocPage = await pdfDocument.getPage(tocPageIndex);
  const textContent = await tocPage.getTextContent();
  
  // 将文本内容转换为按垂直位置排序的行
  const textItems = textContent.items;
  const lines: {y: number, items: any[]}[] = [];
  
  // 对文本项按照y坐标分组
  textItems.forEach((item: any) => {
    const y = Math.round(item.transform[5]); // y坐标
    let line = lines.find(l => Math.abs(l.y - y) < 2); // 允许2个单位的误差
    
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    
    line.items.push(item);
  });
  
  // 按y坐标从大到小排序（PDF坐标系从下到上）
  lines.sort((a, b) => b.y - a.y);
  
  // 处理每一行，提取章节标题和页码
  for (let i = 0; i < lines.length; i++) {
    const lineItems = lines[i].items;
    lineItems.sort((a: any, b: any) => a.transform[4] - b.transform[4]); // 按x坐标排序
    
    const lineText = lineItems.map((item: any) => item.str).join('').trim();
    
    // 使用正则表达式匹配章节标题和页码
    // 匹配模式：任何文本，后跟点线(可选)，然后是页码
    const match = lineText.match(/^(.+?)(?:\.{2,}|\s{3,}|\t+)(\d+)$/);
    // 或者匹配 "第X章 标题 123" 的格式
    const chapterMatch = lineText.match(/^(第\s*\d+\s*[章节篇]\s*.+?)(\d+)$/);
    // 或者匹配 "1. 标题 123" 的格式
    const numberedMatch = lineText.match(/^(\d+\.\s*.+?)(\d+)$/);
    
    // 如果找到匹配
    if (match || chapterMatch || numberedMatch) {
      const m = match || chapterMatch || numberedMatch;
      if (m && m.length >= 3) {  // 确保m不为null且有足够的分组
        const title = m[1].trim();
        const pageNumber = parseInt(m[2], 10);
        
        // 忽略无效页码（如果页码大于文档总页数的两倍，可能是错误匹配）
        if (pageNumber <= pdfDocument.numPages * 2) {
          outline.push({
            title,
            pageNumber,
            level: 1
          });
        }
      }
    }
  }
  
  // 按页码排序并移除重复项
  return outline
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .filter((item, index, self) => 
      index === 0 || item.pageNumber !== self[index - 1].pageNumber);
}

/**
 * 综合提取PDF目录结构
 * 先尝试从书签提取，如果没有书签再尝试从目录页提取
 * @param pdfPath PDF文件路径
 * @param options 处理选项
 * @returns 目录结构结果，包含提取方式
 */
export async function extractPdfOutline(pdfPath: string, options: PdfProcessOptions): Promise<OutlineResult> {
  console.log('正在提取PDF目录结构...');
  
  try {
    // 加载PDF文档
    const loadingTask = pdfjsLib.getDocument({
      url: pdfPath,
      disableFontFace: true,
      // @ts-ignore - pdfjsLib类型定义问题，但实际运行正常
      nativeImageDecoderSupport: 'none'
    });
    
    const pdfDocument = await loadingTask.promise;
    
    // 1. 尝试从书签提取目录
    const bookmarkOutline = await extractOutlineFromBookmarks(pdfDocument);
    
    if (bookmarkOutline.length > 0) {
      console.log(`成功从PDF书签提取到${bookmarkOutline.length}个目录项`);
      return {
        items: bookmarkOutline,
        source: OutlineSource.BOOKMARKS
      };
    }
    
    // 2. 如果没有书签，尝试从目录页提取
    const tocPageIndex = await findTableOfContentsPage(pdfDocument, options.maxTocScanPages);
    
    if (tocPageIndex > 0) {
      const tocOutline = await extractTocFromPage(pdfDocument, tocPageIndex);
      
      if (tocOutline.length > 0) {
        console.log(`成功从目录页提取到${tocOutline.length}个目录项`);
        return {
          items: tocOutline,
          source: OutlineSource.TOC_PAGE
        };
      }
    }
    
    // 3. 都没有找到
    console.log('未能提取到PDF目录结构');
    return {
      items: [],
      source: OutlineSource.NONE
    };
    
  } catch (error) {
    console.error('提取PDF目录结构时出错:', error);
    return {
      items: [],
      source: OutlineSource.NONE
    };
  }
} 