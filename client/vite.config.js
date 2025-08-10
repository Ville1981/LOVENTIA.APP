import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // --- REPLACE START: ensure correct dev/build paths + proxy ---
  root: __dirname,
  publicDir: path.resolve(__dirname, "public"),
  base: "/",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  // --- REPLACE END ---

  plugins: [react()],

  optimizeDeps: {
    // Prebundle MSW so that its ESM exports resolve properly
    // --- REPLACE START: prebundle both MSW core & browser modules ---
    include: ["msw", "msw/browser"],
    // --- REPLACE END ---
  },

  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
