// src/utils/featureToggle.js

const featureFlags = new Map();

/**
 * Lataa feature-flagit konfiguraatiosta tai ympäristömuuttujista
 */
export function loadFeatureFlags(flagsConfig) {
  Object.entries(flagsConfig).forEach(([key, enabled]) => {
    featureFlags.set(key, Boolean(enabled));
  });
}

/**
 * Tarkistaa, onko tietty feature käytössä
 * @param {string} flagName
 * @returns {boolean}
 */
export function isFeatureEnabled(flagName) {
  return featureFlags.get(flagName) === true;
}
