// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier/recommended';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/** @type {import('eslint').Flat.Config[]} */
export default [
  // 基础配置
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.git/**',
      '**/mock/**',
      'packages/demo1/**',
      'packages/plugin/src/test.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // 继承基础规则
      ...js.configs.recommended.rules,
      ...tseslint.configs['recommended'].rules,

      // 允许使用 any 类型
      '@typescript-eslint/no-explicit-any': 'off',
      // 允许将 any/unknown 类型的值赋值给其他类型
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // 允许访问 any 类型的属性
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // 允许返回 any 类型的值
      '@typescript-eslint/no-unsafe-return': 'off',
      // 允许调用 any 类型的函数
      '@typescript-eslint/no-unsafe-call': 'off',
      // 允许类型定义中的冗余成分
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      // 允许不当使用 Promise
      '@typescript-eslint/no-misused-promises': 'off',

      // 未使用变量警告而不是错误
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_'
        }
      ],

      // 允许 console
      'no-console': 'off',

      // 其他规则保持不变
      'prefer-const': 'error',
      'prettier/prettier': 'error'
    }
  },

  // Prettier 配置 (放在最后以确保覆盖其他规则)
  prettier
];
