// File: server/src/utils/featureToggle.js

// --- REPLACE START: convert ESM exports to CommonJS; preserve API shape ---
const featureFlags = new Map();

/**
 * Loads feature flags from a config object (e.g., env-parsed).
 * @param {Record<string, any>} flagsConfig
 */
function loadFeatureFlags(flagsConfig) {
  Object.entries(flagsConfig || {}).forEach(([key, enabled]) => {
    featureFlags.set(key, Boolean(enabled));
  });
}

/**
 * Checks if a given feature flag is enabled.
 * @param {string} flagName
 * @returns {boolean}
 */
function isFeatureEnabled(flagName) {
  return featureFlags.get(flagName) === true;
}

module.exports = {
  loadFeatureFlags,
  isFeatureEnabled,
};
// --- REPLACE END ---
