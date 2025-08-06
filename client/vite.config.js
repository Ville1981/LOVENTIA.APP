import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // --- REPLACE START: adjust root, publicDir, base, and build.outDir ---
  // Serve from this folder as project root
  root: __dirname,
  // Static assets are in the "public" folder at project root
  publicDir: path.resolve(__dirname, 'public'),
  // Base URL for all built assets
  base: '/',
  build: {
    // Output build into "dist" at project root
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
