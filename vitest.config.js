// File: vitest.config.js

// --- REPLACE START: Vitest config wired to src/setupTests.js, jsdom env, and modern deps optimizer ---
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
      "@src": r("src"),
      "@components": r("src/components"),
      "@utils": r("src/utils"),
      "@pages": r("src/pages"),
      "@i18n": r("src/i18n"),
      // Pin to project copies (avoid hoisted duplicates)
      react: r("node_modules/react"),
      "react-dom": r("node_modules/react-dom"),
      history: r("node_modules/history"),
    },
  },

  test: {
    // 1) Browser-like environment for React Testing Library
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
        pretendToBeVisual: true,
      },
    },

    // 2) Global setup (router & i18n stubs, polyfills, jest-dom, etc.)
    //    IMPORTANT: In src/setupTests.js, import the Vitest flavor:
    //      import "@testing-library/jest-dom/vitest";
    setupFiles: ["src/setupTests.js"],

    // 3) Vitest globals (fixes "describe/it/expect is not defined")
    globals: true,

    // 4) Pre-optimize ESM deps to keep workers happy
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
      "src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      "coverage",
      "**/.{history,cache,tmp,temp}/**",
      "../server/**",
      "cypress/**",
      "playwright/**",
    ],

    // Stability & CI ergonomics
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
        "vite-env.d.ts",
        "src/main.jsx",
        "src/**/index.js",
      ],
      lines: 35,
      functions: 20,
      branches: 25,
      statements: 35,
    },
  },
});
// --- REPLACE END ---















