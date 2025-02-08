import { defineConfig } from 'vite';
import mockPlugin from 'vite-plugin-mock';

export default defineConfig({
  plugins: [
    mockPlugin({
      dir: 'mock',
      urlPath: '/api',
      // 只加载 mock/api 目录下的文件
      include: 'mock/api/**/*.{js,ts}',
      // 排除测试文件
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
});
