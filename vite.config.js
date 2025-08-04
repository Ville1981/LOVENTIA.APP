// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
  The replacement regions are marked between:
    // --- REPLACE START … 
    // --- REPLACE END
  so you can verify exactly what changed.
*/

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // --- REPLACE START: proxy /api to backend ---
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // --- REPLACE END ---
    },
  },
  optimizeDeps: {
    // --- REPLACE START: pre-bundle MSW to expose `rest` correctly ---
    include: ['msw'],
    // --- REPLACE END ---
  },
});
