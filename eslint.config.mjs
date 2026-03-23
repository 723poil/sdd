import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'import/no-default-export': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Renderer should use the typed preload API instead of Electron directly.',
            },
            {
              name: 'node:fs',
              message: 'Renderer must not access the file system directly.',
            },
            {
              name: 'node:fs/promises',
              message: 'Renderer must not access the file system directly.',
            },
            {
              name: 'node:path',
              message: 'Renderer should not depend on raw file system paths.',
            },
          ],
          patterns: [
            {
              group: ['@/infrastructure/*', '@/main/*'],
              message: 'Renderer must stay behind IPC and application-facing contracts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Domain code must stay framework-free.',
            },
            {
              name: 'react',
              message: 'Domain code must stay framework-free.',
            },
            {
              name: 'node:fs',
              message: 'Domain code must stay framework-free.',
            },
            {
              name: 'node:fs/promises',
              message: 'Domain code must stay framework-free.',
            },
            {
              name: 'node:path',
              message: 'Domain code must stay framework-free.',
            },
          ],
          patterns: [
            {
              group: ['@/renderer/*', '@/main/*', '@/infrastructure/*'],
              message: 'Domain must not depend on renderer, main, or infrastructure layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/main/**/*.{ts,tsx}', 'src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['electron.vite.config.ts', 'eslint.config.mjs'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
);
