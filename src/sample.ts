/**
 * 示例文件：演示如何使用PDF拆分工具
 */

// 使用此工具的方法很简单，只需在input目录中放入PDF文件，然后运行程序

const showExamples = (): void => {
  console.log('PDF拆分工具使用示例：');
  console.log('');
  console.log('1. 准备工作');
  console.log('   创建input目录: mkdir input');
  console.log('   将PDF文件复制到input目录');
  console.log('');
  console.log('2. 运行程序');
  console.log('   基本用法: npm start');
  console.log('   回退模式: npm start -- --fallback-mode --pages-per-file=20');
  console.log('');
  console.log('3. 自定义目录（可选）');
  console.log('   npm start -- --input-dir=./my_pdfs --output-dir=./results');
  console.log('');
  console.log('4. 回退模式说明');
  console.log('   当PDF没有目录结构时，使用--fallback-mode参数可按页数拆分');
  console.log('   --pages-per-file=N 参数可指定每个文件包含N页（默认10页）');
  console.log('');
  console.log('5. 输出结果');
  console.log('   在output目录下，每个PDF文件都有一个对应的子目录');
  console.log('   例如，处理input/book.pdf后，会在output/book/目录下生成拆分后的文件');
  console.log('');
  console.log('更多信息请查看README.md文件或运行：');
  console.log('npm start -- --help');
};

// 执行示例展示
showExamples(); 