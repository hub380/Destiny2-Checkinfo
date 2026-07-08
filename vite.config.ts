import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const pageNames = ['index', 'career', 'gear', 'fireteam', 'guides'];

/** Source HTML lives in pages/; public URLs stay /career.html etc. */
function pageHtmlLayout(): Plugin {
  return {
    name: 'page-html-layout',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === '/' || url === '/index.html') {
          req.url = '/pages/index.html';
        } else {
          const match = url.match(/^\/([a-z]+)\.html$/);
          if (match && pageNames.includes(match[1])) {
            req.url = `/pages/${match[1]}.html`;
          }
        }
        next();
      });
    },
    closeBundle() {
      const pagesDir = join(rootDir, 'dist/pages');
      if (!existsSync(pagesDir)) return;
      for (const name of readdirSync(pagesDir)) {
        if (!name.endsWith('.html')) continue;
        renameSync(join(pagesDir, name), join(rootDir, 'dist', name));
      }
      rmSync(pagesDir, { recursive: true, force: true });
    }
  };
}

export default defineConfig({
  plugins: [react(), pageHtmlLayout()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@lib': resolve(rootDir, 'src/lib'),
      '@frontend': resolve(rootDir, 'src/frontend')
    }
  },
  css: {
    postcss: {}
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    hmr: true,
    watch: {
      ignored: ['**/.env', '**/.env.*', '**/*.body.js']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(rootDir, 'pages/index.html'),
        career: resolve(rootDir, 'pages/career.html'),
        gear: resolve(rootDir, 'pages/gear.html'),
        fireteam: resolve(rootDir, 'pages/fireteam.html'),
        guides: resolve(rootDir, 'pages/guides.html')
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => chunkInfo.name === 'vendor-react'
          ? 'assets/vendor-react-[hash].js'
          : 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (normalizedId.includes('/src/frontend/components/')) {
            return 'shared-ui';
          }
          if (normalizedId.includes('/src/frontend/hooks/')) {
            return 'shared-hooks';
          }
          return undefined;
        }
      }
    }
  }
});
