/**
 * 类型定义文件
 */

// 目录项类型
export interface OutlineItem {
  title: string;
  pageNumber: number;
  level: number;
}

// 目录来源枚举
export enum OutlineSource {
  BOOKMARKS = 'bookmarks',    // 从PDF书签提取
  TOC_PAGE = 'toc_page',      // 从目录页提取
  NONE = 'none'               // 未找到目录
}

// 带来源信息的目录结构
export interface OutlineResult {
  items: OutlineItem[];
  source: OutlineSource;
}

// PDF处理选项类型
export interface PdfProcessOptions {
  fallbackMode: boolean;
  pagesPerFile: number;
  maxTocScanPages: number;    // 最多扫描的页数用于查找目录
}

// 命令行参数类型
export interface CliArgs {
  'input-dir': string;
  'output-dir': string;
  'fallback-mode': boolean;
  'pages-per-file': number;
  'max-toc-scan': number;     // 最多扫描前几页查找目录
} 