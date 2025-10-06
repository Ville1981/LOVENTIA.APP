// PATH: server/jest.config.js

// --- REPLACE START: Shim to ensure a single source of truth ---
/**
 * Shim configuration.
 * Delegates to `jest.config.cjs` so tools that auto-pick `jest.config.js`
 * still use the canonical config.
 */
module.exports = require("./jest.config.cjs");
// --- REPLACE END ---
