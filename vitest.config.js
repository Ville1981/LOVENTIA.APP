// File: vitest.config.js

// --- REPLACE START: Vitest config wired to client/src/setupTests.js, jsdom env, and modern deps optimizer ---
import { defineConfig } from "vitest/config";
import path from "node:path";
import url from "node:url";

// Resolve __dirname for ESM
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const r = (...p) => path.resolve(__dirname, ...p);

export default defineConfig({
  resolve: {
    // Ensure a single copy of these libs is used
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    alias: {
      "@src": r("client/src"),
      "@components": r("client/src/components"),
      "@utils": r("client/src/utils"),
      "@pages": r("client/src/pages"),
      "@i18n": r("client/src/i18n"),
      // Pin to project copies
      react: r("node_modules/react"),
      "react-dom": r("node_modules/react-dom"),
      history: r("node_modules/history"),
    },
  },

  test: {
    // 1) Browser-like environment for RTL
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
        pretendToBeVisual: true,
      },
    },

    // 2) Global setup (router & i18n stubs, polyfills, etc.)
    setupFiles: ["client/src/setupTests.js"],

    // 3) Use optimizer include (Vitest v3: deps.inline is deprecated)
    //    This pre-optimizes & inlines troublesome ESM deps so workers don’t timeout resolving them.
    deps: {
      optimizer: {
        web: {
          include: [
            "react",
            "react-dom",
            "react-router",
            "react-router-dom",
            "react-i18next",
            "@testing-library/react",
          ],
        },
      },
    },

    // Test discovery
    include: [
      "client/src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "client/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      "coverage",
      "**/.{history,cache,tmp,temp}/**",
      "server/**",
      "client/cypress/**",
      "client/playwright/**",
    ],

    // Stability & CI ergonomics
    globals: true,
    hookTimeout: 15000,
    testTimeout: 20000,
    teardownTimeout: 10000,
    isolate: true,
    threads: true,
    poolOptions: { threads: { maxThreads: 4 } },

    // Coverage (optional; keeps defaults reasonable)
    coverage: {
      provider: "v8",
      reportsDirectory: r("coverage"),
      reporter: ["text", "html"],
      exclude: [
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "**/__mocks__/**",
        "node_modules/**",
        "coverage/**",
        "client/vite-env.d.ts",
        "client/src/main.jsx",
        "client/src/**/index.js",
      ],
      lines: 35,
      functions: 20,
      branches: 25,
      statements: 35,
    },
  },
});
// --- REPLACE END ---
