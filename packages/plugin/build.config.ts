import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  // 入口文件
  entries: [
    './src/index' // 默认会生成 CJS 和 ESM 格式
  ],

  // 是否生成类型声明文件 (.d.ts)
  declaration: true,

  // 是否在构建前清理输出目录
  clean: true,

  // Rollup 配置（可选）
  rollup: {
    emitCJS: true, // 生成 CommonJS 格式
    cjsBridge: true // 在 ESM 中支持 CommonJS 的互操作
  }
});
