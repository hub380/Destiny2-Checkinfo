import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(rootDir, 'src/lib'),
      '@frontend': resolve(rootDir, 'src/frontend')
    }
  },
  css: {
    postcss: {}
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}']
  }
});
