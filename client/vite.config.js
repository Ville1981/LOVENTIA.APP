import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // --- REPLACE START: serve from client folder as root ---
  root: path.resolve(__dirname, 'client'),
  publicDir: path.resolve(__dirname, 'client/public'),
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
    // if you want to open browser automatically:
    // open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // your backend URL
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    // outDir is relative to `root`, so this writes to client/dist
    outDir: 'dist',
    // if you prefer build into top‐level dist:
    // outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
