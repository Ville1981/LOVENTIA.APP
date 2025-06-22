import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      // Allow serving slick-carousel fonts
      allow: [
        process.cwd(),
        // explicitly include slick-carousel font folder
        path.resolve(process.cwd(), 'node_modules/slick-carousel/slick/fonts'),
      ],
    },
  },
  build: {
    // ensure assets are referenced correctly
    assetsDir: 'assets',
  },
});
