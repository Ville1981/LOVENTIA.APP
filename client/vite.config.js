import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // --- REPLACE START: ensure correct dev/build paths + proxy ---
  const BACKEND = env.VITE_BACKEND_URL || "http://localhost:5000";
  const PROXY_DEBUG = env.VITE_PROXY_DEBUG === "1";

  return {
    root: __dirname,
    publicDir: path.resolve(__dirname, "public"),
    base: "/",
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
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
      host: true,
      strictPort: false,
      // NOTE:
      // - /api is proxied to backend API (prevents /api/api duplication in client code)
      // - /uploads is proxied to backend static server (so relative image paths work during dev)
      // - changeOrigin:true fixes CORS for cookies (refresh token) and static assets
      // - we keep the /api prefix (no rewrite) because server mounts routes under /api/*
      // --- REPLACE START: robust proxy with optional runtime logging ---
      proxy: {
        "/api": {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            if (PROXY_DEBUG) {
              proxy.on("proxyReq", (proxyReq, req) => {
                console.log(`[vite-proxy] ${req.method} ${req.url} -> ${BACKEND}`);
              });
            }
          },
        },
        "/uploads": {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
      },
      // --- REPLACE END ---
    },
  };
});
