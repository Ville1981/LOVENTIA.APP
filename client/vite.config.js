import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // toimii rinnakkain muiden porttien kanssa
    proxy: {
      // Proxy kaikki /api-pyynnöt backendille
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy myös kaikki /uploads-pyynnöt (Expressin static-kansio)
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      // Sallitaan projektin juurihakemisto ja slick-carousel-kansiot fonttien palvelemiseksi
      allow: [
        process.cwd(), // projektin juurihakemisto
        path.resolve(__dirname, 'node_modules/slick-carousel'),
        path.resolve(__dirname, 'node_modules/slick-carousel/slick/fonts'),
      ],
    },
  },
});
