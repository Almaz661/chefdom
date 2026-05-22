import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Vite-конфиг для фронтенда.
// В production: `npm run build` собирает в dist/, который раздаётся express-сервером.
// Локально: `npm run dev:client` запускает dev-сервер на :5173, проксируя /api и /trpc на :3000.

/** Плагин: автоматически бампит CACHE_NAME в sw.js при каждом билде */
function bumpSwCache() {
  return {
    name: 'bump-sw-cache',
    buildStart() {
      const swPath = resolve(__dirname, 'public/sw.js');
      let content = readFileSync(swPath, 'utf-8');
      // Заменяем 'shefdom-vXXX' на 'shefdom-v{timestamp}'
      const newVersion = `shefdom-v${Date.now()}`;
      content = content.replace(
        /const CACHE_NAME = '[^']+'/,
        `const CACHE_NAME = '${newVersion}'`
      );
      writeFileSync(swPath, content, 'utf-8');
      console.log(`[bump-sw-cache] CACHE_NAME → ${newVersion}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), bumpSwCache()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/trpc': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
