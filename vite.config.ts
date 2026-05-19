import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Заготовка под Блок 2.
// На Блоке 1 фронт ещё не подключён — этот файл не запускается в production.
export default defineConfig({
  plugins: [react()],
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
