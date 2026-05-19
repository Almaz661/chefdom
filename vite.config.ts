import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite-конфиг для фронтенда.
// В production: `npm run build` собирает в dist/, который раздаётся express-сервером.
// Локально: `npm run dev:client` запускает dev-сервер на :5173, проксируя /api и /trpc на :3000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
