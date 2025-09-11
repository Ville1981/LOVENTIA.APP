// --- REPLACE START: root-level Vite config targeting ./client with Vitest test-block ---
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const CLIENT_ROOT = path.resolve(__dirname, "client");
  const BACKEND = env.VITE_BACKEND_URL || "http://localhost:5000";
  const PROXY_DEBUG = env.VITE_PROXY_DEBUG === "1";

  return {
    // IMPORTANT: project lives in ./client, config is at repo root
    root: CLIENT_ROOT,
    publicDir: path.resolve(CLIENT_ROOT, "public"),
    base: "/",
    build: {
      outDir: path.resolve(CLIENT_ROOT, "dist"),
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
    },

    resolve: {
      dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
      alias: {
        "@src": path.resolve(CLIENT_ROOT, "src"),
        "@utils": path.resolve(CLIENT_ROOT, "src/utils"),
        "@components": path.resolve(CLIENT_ROOT, "src/components"),
        "@pages": path.resolve(CLIENT_ROOT, "src/pages"),
        "@i18n": path.resolve(CLIENT_ROOT, "src/i18n"),
        // force single copies from repo root node_modules
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        history: path.resolve(__dirname, "node_modules/history"),
      },
    },

    plugins: [react()],

    optimizeDeps: {
      include: ["msw", "msw/browser"],
    },

    // Vitest settings (Vitest can read from Vite config if not using a separate vitest.config)
    test: {
      environment: "jsdom",
      environmentOptions: {
        jsdom: { url: "http://localhost/", pretendToBeVisual: true },
      },
      // setup file path is from Vite root (which we set to CLIENT_ROOT),
      // but Vitest resolves from config location; use absolute path:
      setupFiles: [path.resolve(CLIENT_ROOT, "src/setupTests.js")],
      deps: { inline: ["react-router", "react-router-dom"] },

      // Stability & CI ergonomics
      globals: true,
      hookTimeout: 15000,
      testTimeout: 20000,
      teardownTimeout: 10000,
      isolate: true,
      threads: true,
      poolOptions: { threads: { maxThreads: 4 } },

      coverage: {
        provider: "v8",
        reportsDirectory: path.resolve(CLIENT_ROOT, "coverage"),
        reporter: ["text", "html"],
        exclude: [
          "**/*.test.*",
          "**/*.spec.*",
          "**/__tests__/**",
          "**/__mocks__/**",
          "node_modules/**",
          "coverage/**",
          "client/vite-env.d.ts",
          path.resolve(CLIENT_ROOT, "src/main.jsx"),
          path.resolve(CLIENT_ROOT, "src/**/index.js"),
        ],
        lines: 35,
        functions: 20,
        branches: 25,
        statements: 35,
      },
    },

    server: {
      port: 5174,
      host: true,
      strictPort: false,
      proxy: {
        "^/api": {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy) => {
            if (PROXY_DEBUG) {
              proxy.on("proxyReq", (proxyReq, req) => {
                // eslint-disable-next-line no-console
                console.log(`[vite-proxy] ${req.method} ${req.url} -> ${BACKEND}`);
              });
            }
          },
        },
        "^/uploads": { target: BACKEND, changeOrigin: true, secure: false },
        "^/users": { target: BACKEND, changeOrigin: true, secure: false },
      },
    },
  };
});
// --- REPLACE END ---
