// eslint.config.js
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // 使用 ESLint 推荐规则
  js.configs.recommended,

  // TypeScript 配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.d.ts', 'dist/**', 'build/**'], // 忽略 TypeScript 声明文件和构建目录
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json', // 指向你的 tsconfig.json
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // JavaScript 配置
  {
    files: ['**/*.js', '**/*.jsx'],
    ignores: ['node_modules/**', 'dist/**', 'build/**'], // 忽略 node_modules 和构建目录
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // JavaScript 规则
      'no-unused-vars': 'error',
      'no-console': 'warn',
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // Prettier 集成
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error', // 启用 Prettier 规则
    },
  },

  // 禁用与 Prettier 冲突的 ESLint 规则
  prettierConfig,
];
