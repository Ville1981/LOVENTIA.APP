// File: server/jest.config.js

// --- REPLACE START: ESM-ready Jest config with Babel transform & allowed ESM deps ---
/**
 * Jest config for the server package (ESM).
 * - Uses Node test environment
 * - Ignores manual E2E-like tests under tests/manual in CI
 * - Transpiles ESM syntax in tests/sources via babel-jest
 * - Allows selected ESM deps from node_modules to be transformed (e.g., node-fetch, supertest)
 */
export default {
  testEnvironment: "node",

  // Ignore manual test folder and node_modules
  testPathIgnorePatterns: ["/node_modules/", "/tests/manual/"],

  // Use babel-jest inline so no separate babel.config.* is required
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        presets: [
          [
            "@babel/preset-env",
            {
              targets: { node: "current" },
              modules: "auto",
            },
          ],
        ],
      },
    ],
  },

  // By default node_modules is skipped; whitelist ESM deps that need transpilation
  transformIgnorePatterns: [
    "/node_modules/(?!node-fetch|undici|superagent|supertest)/",
  ],

  coverageProvider: "v8",
};
// --- REPLACE END ---
