// File: vitest.config.mjs
// Use a JS config to avoid TS/rollup type mismatches seen in vitest.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  // --- REPLACE START: ensure single React instance + solid Vitest setup targeting client/**
  resolve: {
    // Deduplicate React to avoid "Invalid hook call" when multiple copies are bundled
    dedupe: ["react", "react-dom"],
    // Force resolution to ROOT node_modules so client/* never pulls a nested copy
    alias: {
      // Point directly to the repo root node_modules (this file is at project root)
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },

  test: {
    // Make Vitest globals (describe/it/expect) available without imports
    globals: true,

    // DOM-like environment for RTL and browser APIs
    environment: "jsdom",

    // Shared bootstrap (RTL matchers, router/i18n mocks, polyfills, storages, etc.)
    // NOTE: setupTests.js lives at the REPO ROOT (not under client/)
    setupFiles: ["setupTests.js"],

    // Look for unit/integration tests under client/src
    include: [
      "client/src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "client/src/tests/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],

    // Exclude E2E, performance, and build artifacts from unit runs
    exclude: [
      "node_modules",
      "dist",
      "coverage",
      "client/cypress/**",
      "client/playwright/**",
      // keep k6/perf stubs out of Vitest (they run with k6)
      "client/performance/**",
      // also exclude root-level performance scripts if present
      "performance/**",
    ],

    // Code coverage (v8 provider via @vitest/coverage-v8)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Store coverage next to client app like before
      reportsDirectory: "client/coverage",
    },
  },
  // --- REPLACE END ---
});
