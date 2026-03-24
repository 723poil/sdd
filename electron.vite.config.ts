import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const sourceRoot = resolve(__dirname, 'src');

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['typescript'],
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': sourceRoot,
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': sourceRoot,
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': sourceRoot,
      },
    },
  },
});
