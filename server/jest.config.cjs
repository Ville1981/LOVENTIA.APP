// PATH: server/jest.config.cjs

// --- REPLACE START: Unified Jest config (single source of truth; CJS with optional Babel transform) ---
/**
 * Jest configuration for the server package.
 *
 * Goals:
 * - Single, canonical config (used by all scripts and editors)
 * - Node test environment
 * - Ignore manual E2E-like tests under tests/manual
 * - **Optionally** transpile sources via babel-jest when available (ESM-friendly)
 * - Allow selected ESM deps to be transformed from node_modules if needed
 * - Include practical defaults from the legacy config (testMatch, verbose, timeouts)
 *
 * Notes:
 * - The Babel transform is enabled only if both `babel-jest` and `@babel/preset-env`
 *   are installed. Otherwise, Jest falls back to running plain Node without transform.
 */

const hasBabel = (() => {
  try {
    require.resolve("babel-jest");
    require.resolve("@babel/preset-env");
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
  verbose: true,
  forceExit: true, // If you prefer open handle diagnostics, remove this and use --detectOpenHandles in CLI
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
                  modules: "auto",
                },
              ],
            ],
          },
        ],
      }
    : {},

  // By default node_modules is skipped; whitelist ESM deps that often need transpilation
  transformIgnorePatterns: ["/node_modules/(?!node-fetch|undici|superagent|supertest)/"],

  coverageProvider: "v8",
};

module.exports = config;
// --- REPLACE END ---
