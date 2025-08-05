import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],

  // --- REPLACE START: ensure MSW is pre-bundled as ESM so that `rest` is available ---
  optimizeDeps: {
    include: ['msw'],
  },
  // --- REPLACE END ---

  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // your backend URL
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
