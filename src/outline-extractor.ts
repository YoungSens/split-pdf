import pdfjsLib from './pdfjs-config';
import { OutlineItem, OutlineResult, OutlineSource, PdfProcessOptions } from './types';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { RefProxy, TextItem } from 'pdfjs-dist/types/src/display/api';

async function matchPageIndex(doc: PDFDocumentProxy, dest: any): Promise<number> {
  let ref: RefProxy | null = null;
  let _dest = Array.isArray(dest) ? dest : await doc.getDestination(dest);
  if (_dest && _dest.length > 0) {
    ref = _dest[0] as RefProxy;
    return await doc.getPageIndex(ref);
  }
  return -1;
}

/**
 * 从PDF书签提取目录结构
 * @param doc PDF文档对象
 * @returns 目录项数组
 */
export async function extractOutlineFromBookmarks(doc: PDFDocumentProxy): Promise<OutlineItem[]> {
  try {
    const outline = await doc.getOutline();
    
    if (!outline || outline.length === 0) {
      console.log('未找到书签结构');
      return [];
    }
    
    // 处理目录项，提取页码信息
    const processedOutline: OutlineItem[] = [];
    
    for (let i = 0; i < outline.length; i++) {
      const item = outline[i];
      if (item.dest) {
        try {
          const pageNumber = await matchPageIndex(doc, item.dest);
          if (pageNumber === -1) {
            console.warn(`跳过目录项 "${item.title}"，无效的目标引用`);
            continue;
          }
          // level 假设顶级章节 
          processedOutline.push({ title: item.title.trim(), page: pageNumber, level: 1 });
        } catch (err) {
          console.warn(`无法解析目录项 "${item.title}" 的页码信息: ${(err as Error).message}`);
        }
      }
    }
    
    return processedOutline;
  } catch (error) {
    console.error('提取PDF书签结构时出错:', error);
    return [];
  }
}

async function matchPageByText(doc: PDFDocumentProxy, maxScanPages: number): Promise<PDFPageProxy | null> {
  // 目录页特征关键词
  const tocKeywords = ['目录'];
  // 目录项特征：通常包含多个"......"或点线加页码
  const tocItemPatterns: RegExp[] = [
    /\.{3,}\s*\d+/,  // ....... 123
  ];
  
  const numPages = doc.numPages;
  // 只扫描前几页
  const pagesToScan = Math.min(maxScanPages, numPages);
  
  console.log(`开始扫描前${pagesToScan}页查找目录页...`);

  let target: PDFPageProxy | null = null;
  
  for (let i = 1; i <= pagesToScan; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any)=> item.str).join('').toLowerCase().replace(/ /g,'');

    // 检查是否包含目录关键词
    const hasKeyword = tocKeywords.some(keyword => text.includes(keyword.toLowerCase()));
    // 检查是否包含目录项特征
    const hasPattern = tocItemPatterns.some(pattern => pattern.test(text));

    const annotations = await page.getAnnotations();

    if (hasKeyword && hasPattern && annotations.length > 0) {
      target = page;
      break;
    }
  }

  return target;
}

type Line = {
  y: number;
  text: string;
}

type Rect = [left: number, top: number, right: number, bottom: number]

function matchLine(lines: Line[], rect: Rect, startIdx: number = 0): number {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.y >= rect[1] && line.y <= rect[3]) {
      return i;
    }
  }
  return -1;
}

async function extractOutlineFromPage(doc: PDFDocumentProxy, page: PDFPageProxy, maxPages: number): Promise<OutlineItem[]> {
  console.log(`从 target page 页提取目录内容...`);
  
  const outline: OutlineItem[] = [];
  const textContent = await page.getTextContent();
  
  // 将文本内容转换为按垂直位置排序的行
  const lines: Line[] = [];
  const items = textContent.items.filter((item: any) => !!item.transform) as TextItem[];

  // 对文本项按照y坐标分组
  let shouldNotAppend = false;
  items.forEach((item) => {
    const y = item.transform[5]; // y坐标
    let line = lines.find(l => Math.abs(l.y - y) < 2); // 允许2个单位的误差
    
    if (!line) {
      shouldNotAppend = false;
      line = { y, text: '' };
      lines.push(line);
    }
    line.text += item.str;
  });

  lines.sort((a, b) => a.y - b.y).forEach(l => {
    const arr = l.text.split('..');
    l.text = arr.length > 1 ? arr[0].trim() : '';
  });

  const annotations = await page.getAnnotations();
  annotations.sort((a, b) => a.rect[1] - b.rect[1]);

  // 上次查找的行
  let lastLineIdx = -1;
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (annotation.subtype === 'Link' && annotation.dest) {
      const pageNumber = await matchPageIndex(doc, annotation.dest);
      if (pageNumber === -1) {
        console.warn(`跳过目录项 "${annotation.title}"，无效的目标引用`);
        continue;
      }
      // 从 lines 中找到与注释 y 坐标最接近的行
      lastLineIdx = matchLine(lines, annotation.rect, lastLineIdx + 1);
      const title = lastLineIdx === -1 ? `${i}` : lines[lastLineIdx].text;
      // level 假设顶级章节 
      outline.push({ title, page: pageNumber, level: 1 });
    }
  }

  // 按页码排序并移除重复项
  return outline;
} 

/**
 * 查找目录页
 * 通过扫描PDF的前几页内容，寻找含有"目录"、"Contents"等关键词的页面
 * @param doc PDF文档对象
 * @param maxScanPages 最大扫描页数
 * @returns 目录页索引，如未找到则返回-1
 */
export async function findTableOfContentsPage(doc: PDFDocumentProxy, maxScanPages: number): Promise<OutlineItem[]> {
  const page = await matchPageByText(doc, maxScanPages);
  if (!page) return [];
  return await extractOutlineFromPage(doc, page, doc.numPages);
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
    
    const doc = await loadingTask.promise;
    
    // 1. 尝试从书签提取目录
    const bookmarkOutline = await extractOutlineFromBookmarks(doc);
    
    if (bookmarkOutline.length > 0) {
      console.log(`成功从PDF书签提取到${bookmarkOutline.length}个目录项`);
      return {
        items: bookmarkOutline,
        source: OutlineSource.BOOKMARKS
      };
    }
    
    // 2. 如果没有书签，尝试从目录页提取
    const tocOutline = await findTableOfContentsPage(doc, options.maxTocScanPages);
    if (tocOutline.length > 0) {
      console.log(`成功从目录页提取到${tocOutline.length}个目录项`);
      return {
        items: tocOutline,
        source: OutlineSource.TOC_PAGE
      };
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