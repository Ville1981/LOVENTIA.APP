// PATH: server/jest.config.cjs

// --- REPLACE START: Unified Jest config (single source of truth; CJS with optional Babel transform & optional JUnit reporter) ---
/**
 * Jest configuration for the server package.
 *
 * Goals:
 * - Single, canonical config (used by all scripts and editors)
 * - Node test environment
 * - Ignore manual E2E-like tests under tests/manual
 * - **Optionally** transpile sources via babel-jest when available (ESM-friendly)
 * - **Optionally** add JUnit reporter when jest-junit is available (for CI)
 * - Allow selected ESM deps to be transformed from node_modules if needed
 * - Include practical defaults from the legacy config (testMatch, verbose, timeouts)
 *
 * Notes:
 * - The Babel transform is enabled only if both `babel-jest` and `@babel/preset-env`
 *   are installed. Otherwise, Jest falls back to running plain Node without transform.
 * - The JUnit reporter is included only if `jest-junit` is installed, so CI won’t fail
 *   locally if it’s missing.
 */

/* eslint-disable import/no-commonjs */

const path = require("node:path");

const hasBabel = (() => {
  try {
    require.resolve("babel-jest");
    require.resolve("@babel/preset-env");
    return true;
  } catch {
    return false;
  }
})();

const hasJunit = (() => {
  try {
    require.resolve("jest-junit");
    return true;
  } catch {
    return false;
  }
})();

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",

  // Legacy defaults kept for compatibility and determinism
  testMatch: ["**/__tests__/**/*.test.js"],

  // Keep output readable while running in CI
  verbose: true,

  // If you prefer open handle diagnostics, remove this and add --detectOpenHandles in CLI
  forceExit: true,

  testTimeout: 30000,

  // Ignore folders not meant for CI
  testPathIgnorePatterns: ["/node_modules/", "/tests/manual/"],

  // Enable Babel transform only when deps are installed to avoid hard dependency
  transform: hasBabel
    ? {
        "^.+\\.[jt]sx?$": [
          require.resolve("babel-jest"),
          {
            presets: [
              [
                require.resolve("@babel/preset-env"),
                {
                  targets: { node: "current" },
                  modules: "auto"
                }
              ]
            ]
          }
        ]
      }
    : {},

  // By default node_modules is skipped; whitelist ESM deps that often need transpilation
  transformIgnorePatterns: ["/node_modules/(?!node-fetch|undici|superagent|supertest)/"],

  coverageProvider: "v8",

  // Collect useful coverage by default; tweak paths as needed
  collectCoverage: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.[cm]js",
    "!<rootDir>/src/**/*.d.ts",
    "!<rootDir>/src/**/__tests__/**",
    "!<rootDir>/src/**/?(*.)+(test|spec).[cm]js"
  ],
  coverageDirectory: path.join(__dirname, "coverage"),
  coverageReporters: ["text", "html", "lcov"],

  // Add junit reporter only if installed (keeps local runs simple, CI can still pass CLI flags)
  reporters: hasJunit
    ? [
        "default",
        [
          "jest-junit",
          {
            outputDirectory: path.join(__dirname, "test-results"),
            outputName: "junit.xml"
          }
        ]
      ]
    : ["default"],

  moduleFileExtensions: ["js", "mjs", "cjs", "json"],

  // Map path aliases here if you use them in the server (currently none).
  moduleNameMapper: {
    // Example (uncomment if you have an alias):
    // "^@src/(.*)$": "<rootDir>/src/$1",
  },

  // Setup hooks for test env (add files only if you actually have them)
  setupFilesAfterEnv: [
    // "<rootDir>/src/setupTests.js"
  ]
};

module.exports = config;
// --- REPLACE END ---


