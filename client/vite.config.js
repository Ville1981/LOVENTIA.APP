// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // --- REPLACE START: adjust root, publicDir, base, and build.outDir ---
  root: __dirname,
  publicDir: path.resolve(__dirname, 'public'),
  base: '/',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  // --- REPLACE END ---

  plugins: [
    react(),
  ],

  optimizeDeps: {
    include: [
      'msw',
      'msw/browser'
    ],
  },

  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});