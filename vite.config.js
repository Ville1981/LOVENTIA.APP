<<<<<<< HEAD
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  css: {
    // Explicitly reference your PostCSS config
    postcss: path.resolve(__dirname, "postcss.config.cjs"),
  },

  server: {
    port: 5174,
    hmr: { overlay: false },
    proxy: {
      // Proxy all /api/* requests to the backend unchanged
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      // Proxy uploaded assets
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(
          __dirname,
          "node_modules",
          "slick-carousel",
          "slick",
          "fonts"
        ),
      ],
    },
  },

  build: {
    assetsDir: "assets",
  },

  // --- REPLACE START: ensure MSW is pre-bundled for browser mocks
  optimizeDeps: {
    include: ["msw"],
  },
  // --- REPLACE END
=======
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // toimii rinnakkain muiden porttien kanssa
  },
>>>>>>> origin/main
});
