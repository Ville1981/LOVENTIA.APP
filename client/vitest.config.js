// PATH: client/vitest.config.js

// --- REPLACE START: Vitest config (jsdom + globals + setup + include src-only + exclude performance + tuned coverage) ---
// Tell ESLint this is a Node config file, and silence the false-positive for 'vitest/config'
/* eslint-env node */
/* eslint-disable import/no-unresolved */

import { defineConfig } from "vitest/config";

export default defineConfig({
  /**
   * Vitest configuration for client tests
   * - jsdom environment for React Testing Library
   * - Global test APIs (describe/it/expect) enabled
   * - setupFiles points to client/setupTests.js
   * - only run tests in src/, exclude performance stubs and artifacts
   * - disable PostCSS processing during tests to avoid BOM/JSON parse issues from third-party CSS
   * - coverage includes ONLY src/** and excludes setup/tests helpers
   */
  test: {
    environment: "jsdom",
    globals: true,

    // Correct setup path (relative to client/)
    setupFiles: ["./setupTests.js"],

    // Run ONLY the tests under src/
    include: [
      "src/**/*.test.{js,jsx,ts,tsx}",
      "src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],

    // Skip non-test folders and performance (k6) stubs
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/cypress/**",
      "**/performance/**",
    ],

    // Keep JSDOM URL stable for components using window.location
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Instrument only source files under src/
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      // Do not count test setup and test files themselves
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.test.{js,jsx,ts,tsx}",
        "src/setupTests.{js,ts}",
        "src/test-utils.{js,ts}",
      ],
    },
  },

  // Prevent Vite from attempting to load a PostCSS config during tests
  css: {
    postcss: { plugins: [] },
  },
});
// --- REPLACE END ---
