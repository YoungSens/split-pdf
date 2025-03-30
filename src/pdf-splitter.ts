import * as fs from 'fs-extra';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { OutlineItem, OutlineSource, OutlineResult, PdfProcessOptions } from './types';

/**
 * 按页数拆分PDF
 * @param pdfPath 源PDF路径
 * @param totalPages 总页数
 * @param pagesPerFile 每个文件的页数
 * @param outputDir 输出目录
 * @param baseFilename 基本文件名
 */
export async function splitPdfByPages(
  pdfPath: string,
  totalPages: number,
  pagesPerFile: number,
  outputDir: string,
  baseFilename: string
): Promise<void> {
  console.log(`按每个文件${pagesPerFile}页进行拆分`);
  
  // 确保输出目录存在
  await fs.ensureDir(outputDir);
  
  try {
    // 读取PDF文件
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // 计算需要拆分的文件数
    const numFiles = Math.ceil(totalPages / pagesPerFile);
    
    for (let i = 0; i < numFiles; i++) {
      const startPage = i * pagesPerFile;
      const endPage = Math.min((i + 1) * pagesPerFile, totalPages);
      
      console.log(`正在处理第${i + 1}部分，页码范围：${startPage + 1}-${endPage}`);
      
      // 创建新的PDF文档
      const newPdfDoc = await PDFDocument.create();
      
      // 复制页面
      for (let pageIndex = startPage; pageIndex < endPage; pageIndex++) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
        newPdfDoc.addPage(copiedPage);
      }
      
      // 保存新的PDF
      const newPdfBytes = await newPdfDoc.save();
      const outputPath = path.join(outputDir, `${baseFilename}-${i + 1}.pdf`);
      
      await fs.writeFile(outputPath, newPdfBytes);
      console.log(`已保存部分: ${outputPath}`);
    }
    
  } catch (error) {
    console.error('按页数拆分PDF时出错:', error);
  }
}

/**
 * 按照目录项拆分PDF
 * @param pdfDoc 源PDF文档
 * @param outline 目录数组
 * @param totalPages PDF总页数
 * @param outputDir 输出目录
 * @param baseFilename 基本文件名
 */
export async function splitByOutlineItems(
  pdfDoc: PDFDocument,
  outline: OutlineItem[],
  totalPages: number,
  outputDir: string,
  baseFilename: string
): Promise<void> {
  console.log(`按照${outline.length}个目录项拆分PDF`);
  
  // 拆分每个章节
  for (let i = 0; i < outline.length; i++) {
    const chapter = outline[i];
    // 页码从0开始计算
    const startPage = chapter.pageNumber - 1;
    const endPage = i < outline.length - 1 
      ? outline[i + 1].pageNumber - 1
      : totalPages;
    
    // 如果当前章节和下一章节页码相同，跳过
    if (startPage >= endPage) {
      console.log(`跳过章节: ${chapter.title}，页码范围无效：${startPage + 1}-${endPage}`);
      continue;
    }
    
    console.log(`正在处理章节: ${chapter.title}，页码范围：${startPage + 1}-${endPage}`);
    
    try {
      // 创建新的PDF文档
      const newPdfDoc = await PDFDocument.create();
      
      // 复制页面
      for (let pageIndex = startPage; pageIndex < endPage; pageIndex++) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
        newPdfDoc.addPage(copiedPage);
      }
      
      // 准备文件名
      // 使用章节标题作为文件名（删除非法字符）
      let chapterTitle = chapter.title
        .replace(/[\\/:*?"<>|]/g, '_')  // 替换Windows不允许的文件名字符
        .substring(0, 50);  // 限制长度
      
      // 保存新的PDF
      const newPdfBytes = await newPdfDoc.save();
      const outputPath = path.join(
        outputDir, 
        `${baseFilename}-${i + 1}-${chapterTitle}.pdf`
      );
      
      await fs.writeFile(outputPath, newPdfBytes);
      console.log(`已保存章节: ${outputPath}`);
    } catch (error) {
      console.error(`处理章节 "${chapter.title}" 时出错:`, error);
    }
  }
}

/**
 * 完整的PDF拆分流程
 * @param pdfPath PDF路径
 * @param outlineResult 目录提取结果
 * @param options 处理选项
 * @param outputDir 输出目录
 * @param baseFilename 基本文件名
 */
export async function splitPdf(
  pdfPath: string,
  outlineResult: OutlineResult,
  options: PdfProcessOptions,
  outputDir: string,
  baseFilename: string
): Promise<void> {
  console.log('开始拆分PDF...');
  
  // 确保输出目录存在
  await fs.ensureDir(outputDir);
  
  try {
    // 读取PDF文件
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    
    const { items: outline, source } = outlineResult;
    
    // 如果有目录结构（无论是书签还是从目录页提取）
    if (outline.length > 0) {
      console.log(`使用${source === OutlineSource.BOOKMARKS ? '书签' : '目录页'}提取的目录结构拆分PDF`);
      await splitByOutlineItems(pdfDoc, outline, totalPages, outputDir, baseFilename);
    } 
    // 如果没有目录，且启用了回退模式，则按页数拆分
    else if (options.fallbackMode) {
      console.log('没有目录结构，启用回退模式，按页数拆分');
      await splitPdfByPages(pdfPath, totalPages, options.pagesPerFile, outputDir, baseFilename);
    } 
    // 都不满足，无法拆分
    else {
      console.log('没有目录结构，也没有启用回退模式，无法拆分PDF');
    }
    
    console.log('PDF拆分完成！');
  } catch (error) {
    console.error('拆分PDF时出错:', error);
  }
} 