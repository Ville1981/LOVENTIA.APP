// --- REPLACE START: keep manual tests out of CI to avoid ESM/interactive flows ---
/**
 * Jest config for the server package.
 * - Uses Node test environment
 * - Ignores manual E2E-like tests under tests/manual in CI
 *   (they often need real secrets/browsers and can include ESM-only syntax)
 */
module.exports = {
  testEnvironment: "node",
  // Keep the default Jest resolver; just ignore manual tests folder.
  testPathIgnorePatterns: ["/node_modules/", "/tests/manual/"],
  // If you later need to support ESM in tests, add a transformer here.
};
// --- REPLACE END ---
