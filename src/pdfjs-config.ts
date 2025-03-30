/**
 * PDF.js 配置文件
 * 用于在Node.js环境中配置PDF.js
 */

import * as path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// 定义自定义Canvas上下文接口
interface CanvasContextMock {
  _operationsLog: string[];
  mozCurrentTransform: number[];
  save: () => void;
  restore: () => void;
  transform: () => void;
  beginPath: () => void;
  moveTo: () => void;
  lineTo: () => void;
  closePath: () => void;
  stroke: () => void;
  fill: () => void;
  measureText: () => { width: number };
  fillText: () => void;
  rect: () => void;
}

// 定义自定义Canvas接口
interface CanvasMock {
  width: number;
  height: number;
}

// 定义CanvasAndContext接口
interface CanvasAndContext {
  canvas: CanvasMock;
  context: CanvasContextMock;
}

// PDF.js 在Node.js环境中需要特殊的工作器设置
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'legacy',
  'build',
  'pdf.worker.js'
);

// 配置Node环境（避免使用canvas）
// 创建自定义的CanvasFactory
class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    return {
      canvas: {
        width,
        height,
      },
      context: {
        // 使用虚拟上下文，只需要很少的操作，因为我们只需要提取文本和结构
        _operationsLog: [],
        mozCurrentTransform: [1, 0, 0, 1, 0, 0],
        save: function() { this._operationsLog.push('save'); },
        restore: function() { this._operationsLog.push('restore'); },
        transform: function() { this._operationsLog.push('transform'); },
        beginPath: function() { this._operationsLog.push('beginPath'); },
        moveTo: function() { this._operationsLog.push('moveTo'); },
        lineTo: function() { this._operationsLog.push('lineTo'); },
        closePath: function() { this._operationsLog.push('closePath'); },
        stroke: function() { this._operationsLog.push('stroke'); },
        fill: function() { this._operationsLog.push('fill'); },
        measureText: function() { return { width: 0 }; },
        fillText: function() { this._operationsLog.push('fillText'); },
        rect: function() { this._operationsLog.push('rect'); },
      },
    };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: CanvasAndContext): void {
    // 什么都不做
  }
}

// 设置自定义CanvasFactory
(pdfjsLib as any).CanvasFactory = NodeCanvasFactory;

// 禁用 PDFBug
(pdfjsLib as any).useNativeCanvas = false;

export default pdfjsLib; 