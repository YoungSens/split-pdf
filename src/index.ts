import * as path from 'path';
import * as fs from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { PdfProcessOptions, CliArgs } from './types';
import { extractPdfOutline } from './outline-extractor';
import { splitPdf } from './pdf-splitter';

// 配置命令行参数
const argv = yargs(hideBin(process.argv))
  .option('input-dir', {
    alias: 'i',
    type: 'string',
    description: '输入PDF文件目录',
    default: './input'
  })
  .option('output-dir', {
    alias: 'o',
    type: 'string',
    description: '输出PDF文件目录',
    default: './output'
  })
  .option('fallback-mode', {
    alias: 'f',
    type: 'boolean',
    description: '当没有找到目录结构时，是否启用按页数拆分',
    default: false
  })
  .option('pages-per-file', {
    alias: 'p',
    type: 'number',
    description: '当使用回退模式时，每个拆分文件的页数',
    default: 20
  })
  .option('max-toc-scan', {
    alias: 't',
    type: 'number',
    description: '扫描前几页查找目录页',
    default: 10
  })
  .help()
  .alias('help', 'h')
  .parseSync() as unknown as CliArgs;

/**
 * 处理单个PDF文件
 * @param inputFile 输入文件路径
 * @param outputDir 输出目录根路径
 */
async function processPdfFile(inputFile: string, outputDir: string): Promise<void> {
  try {
    const filename = path.basename(inputFile);
    const filenameWithoutExt = path.basename(inputFile, '.pdf');
    
    console.log(`开始处理PDF文件: ${filename}`);
    
    // 为此文件创建专属输出目录
    const fileOutputDir = path.join(outputDir, filenameWithoutExt);
    await fs.ensureDir(fileOutputDir);
    
    // 处理选项配置
    const options: PdfProcessOptions = {
      fallbackMode: argv['fallback-mode'],
      pagesPerFile: argv['pages-per-file'],
      maxTocScanPages: argv['max-toc-scan']
    };
    
    // 提取目录结构
    const outlineResult = await extractPdfOutline(inputFile, options);

    // TBD: 不一定要过滤，先过滤了吧
    const items = outlineResult.items.sort((a, b) => a.page - b.page).filter((item, index, self) => 
      index === 0 || item.page !== self[index - 1].page
    );

    items.forEach(item => {
      console.log(`- ${item.title} (页码: ${item.page})`);
    });
    
    // 拆分PDF
    await splitPdf(inputFile, outlineResult, options, fileOutputDir, filenameWithoutExt);
    
    console.log(`文件 ${filename} 处理完成`);
    
  } catch (error) {
    console.error(`处理文件 ${inputFile} 时发生错误:`, error);
  }
}

/**
 * 扫描目录下的所有PDF文件
 * @param dir 目录路径
 * @returns PDF文件路径数组
 */
async function scanPdfFiles(dir: string): Promise<string[]> {
  try {
    await fs.ensureDir(dir); // 确保目录存在
    const files = await fs.readdir(dir);
    return files
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => path.join(dir, file));
  } catch (error) {
    console.error('扫描PDF文件时发生错误:', error);
    return [];
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const inputDir = argv['input-dir'];
  const outputDir = argv['output-dir'];
  
  try {
    console.log(`开始扫描目录: ${inputDir}`);
    
    // 扫描输入目录中的所有PDF文件
    const pdfFiles = await scanPdfFiles(inputDir);
    
    if (pdfFiles.length === 0) {
      console.log(`在 ${inputDir} 目录下未找到PDF文件`);
      return;
    }
    
    console.log(`找到 ${pdfFiles.length} 个PDF文件`);
    
    // 确保输出目录存在
    await fs.ensureDir(outputDir);
    
    // 处理每个PDF文件
    for (const pdfFile of pdfFiles) {
      await processPdfFile(pdfFile, outputDir);
    }
    
    console.log('所有PDF文件处理完成！');
    
  } catch (error) {
    console.error('处理PDF时发生错误:', error);
    process.exit(1);
  }
}

// 运行主函数
main(); 