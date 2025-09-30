// PATH: client/vite.config.js

import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // --- REPLACE START: ensure env resolution is scoped to the client dir (prevents accidental ../../package.json lookups) ---
  // Previously: const env = loadEnv(mode, process.cwd(), "");
  // Now: resolve from the config's directory so Vite/esbuild won't traverse up to C:\package.json
  const envDir = path.resolve(__dirname);
  const env = loadEnv(mode, envDir, "");
  // --- REPLACE END ---

  const BACKEND = env.VITE_BACKEND_URL || "http://localhost:5000";
  const PROXY_DEBUG = env.VITE_PROXY_DEBUG === "1";

  return {
    root: __dirname,
    // --- REPLACE START: pin envDir so only client/.env* files are considered ---
    envDir,
    // --- REPLACE END ---
    publicDir: path.resolve(__dirname, "public"),
    base: "/",
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
    },

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
