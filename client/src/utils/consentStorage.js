// PATH: client/src/utils/consentStorage.js

// --- REPLACE START: consent storage (canonical + legacy, migration-safe) ---
export const KEY_CANONICAL = "consent.v1";
export const KEY_LEGACY = "loventia-consent-v1";

/**
 * Read consent from LS.
 * Prefers canonical; falls back to legacy.
 */
export function getConsent() {
  try {
    const c = localStorage.getItem(KEY_CANONICAL);
    if (c) return JSON.parse(c);
  } catch (_) {}

  try {
    const l = localStorage.getItem(KEY_LEGACY);
    if (l) return JSON.parse(l);
  } catch (_) {}

  return null;
}

/**
 * Write consent to canonical key.
 * Optionally mirrors to legacy for one release window (keeps tests green).
 */
export function setConsent(value, { mirrorLegacy = true } = {}) {
  const payload = JSON.stringify(value ?? {});
  localStorage.setItem(KEY_CANONICAL, payload);
  if (mirrorLegacy) {
    localStorage.setItem(KEY_LEGACY, payload);
  }
  // notify app
  try {
    window.dispatchEvent(new CustomEvent("consent:changed", { detail: value }));
  } catch (_) {}
}

/**
 * One-time migration: if legacy exists and canonical missing → move to canonical.
 * Optionally removes legacy (default true).
 */
export function migrateConsent({ removeLegacy = false } = {}) {
  const hasCanon = !!localStorage.getItem(KEY_CANONICAL);
  const legacy = localStorage.getItem(KEY_LEGACY);
  if (!hasCanon && legacy) {
    localStorage.setItem(KEY_CANONICAL, legacy);
    if (removeLegacy) localStorage.removeItem(KEY_LEGACY);
  }
}
// --- REPLACE END ---
