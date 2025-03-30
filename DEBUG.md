# PDF拆分工具调试指南

## VS Code 调试设置

### 步骤1: 创建或修改 launch.json

在 VS Code 中，打开命令面板 (按下 `Cmd+Shift+P` 或 `Ctrl+Shift+P`)，然后输入 "Debug: Open launch.json"，选择 "Node.js" 环境。

如果需要手动创建或编辑，您应该在 `.vscode/launch.json` 文件中添加以下内容:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "调试主程序",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "调试带参数",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "args": ["--fallback-mode", "--pages-per-file=5"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "调试示例文件",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/sample.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "runtimeArgs": ["-r", "ts-node/register"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 步骤2: 运行调试

1. 打开要调试的文件 (例如: `src/index.ts`)
2. 在需要的位置设置断点 (点击行号左侧空白区域，或在代码中添加 `debugger;` 语句)
3. 打开 VS Code 的调试面板 (点击左侧活动栏的"运行和调试"图标，或按 `F5`)
4. 从顶部下拉菜单中选择适当的调试配置 (如 "调试主程序")
5. 点击绿色的播放按钮开始调试

## 命令行调试

如果您喜欢在命令行调试，可以使用以下命令:

```bash
# 调试主程序
npm run debug

# 调试示例文件
npm run debug:test

# 在VS Code中附加的方式调试
npm run debug:vscode
```

然后，您可以:
1. 打开 Chrome 浏览器，访问 chrome://inspect
2. 点击 "Open dedicated DevTools for Node"
3. 调试器将在遇到 `debugger;` 语句或 `--inspect-brk` 标志时暂停

## 调试技巧

### 添加临时调试点

在代码中，您可以添加 `debugger;` 语句来创建临时断点:

```typescript
function someFunction() {
  // 调试器会在此处暂停
  debugger;
  
  // 其他代码...
}
```

### 查看变量和表达式

在调试时，您可以:
- 将鼠标悬停在变量上查看当前值
- 使用 "变量" 面板查看所有可用变量
- 在 "监视" 面板中添加表达式以跟踪特定值
- 在调试控制台中执行表达式

### 调试控制

使用以下控制命令:
- 继续 (F5): 继续执行直到下一个断点
- 单步跳过 (F10): 执行当前行，不进入函数
- 单步进入 (F11): 进入函数调用
- 单步跳出 (Shift+F11): 完成当前函数并返回
- 重启 (Ctrl+Shift+F5): 重新启动调试会话
- 停止 (Shift+F5): 终止调试会话

## 调试特定功能

### 调试PDF目录提取

在 `extractOutline` 函数中添加断点，查看PDF文档结构的提取过程:

```typescript
async function extractOutline(pdfPath: string): Promise<OutlineItem[]> {
  debugger; // 在此处添加断点
  console.log('正在提取PDF目录结构...');
  
  // ... 函数其余部分
}
```

### 调试PDF拆分过程

在 `splitPdfByChapter` 函数中添加断点，查看PDF拆分过程:

```typescript
async function splitPdfByChapter(
  pdfPath: string,
  outline: OutlineItem[],
  outputDir: string,
  baseFilename: string
): Promise<void> {
  debugger; // 在此处添加断点
  console.log('开始按章节拆分PDF...');
  
  // ... 函数其余部分
}
```

## 常见问题解决

### 断点不命中

如果断点不命中，请确保:
1. sourceMaps 设置为 true
2. tsconfig.json 中 sourceMap 选项已启用
3. 使用了正确的调试配置

### 无法看到特定变量

某些变量可能超出作用域或已被优化掉。尝试:
1. 在更早的点设置断点
2. 添加显式的 `console.log()` 语句
3. 在调试控制台中使用表达式查询变量 