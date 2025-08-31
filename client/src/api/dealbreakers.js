// File: client/src/api/dealbreakers.js
// --- REPLACE START: Robust client API for dealbreakers (GET/PATCH + discover), with safe payload shaping ---
import api from "./index";

/**
 * Shape used across the app for dealbreakers.
 * Keep this in sync with server/routes/dealbreakers.js response schema.
 */
const DEFAULT_DEALBREAKERS = Object.freeze({
  distanceKm: null,
  ageMin: null,
  ageMax: null,
  mustHavePhoto: false,
  nonSmokerOnly: false,
  noDrugs: false,
  petsOk: null, // true/false/null
  religion: [],
  education: [],
});

/** Keys allowed to be sent to the backend (PATCH whitelist). */
const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_DEALBREAKERS));

/**
 * Coerce incoming raw value into the canonical type used by the UI/server.
 * This protects against accidental string/bool mixups from forms.
 */
function coerceValue(key, value) {
  switch (key) {
    case "distanceKm":
    case "ageMin":
    case "ageMax": {
      if (value === "" || value === null || typeof value === "undefined") return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "mustHavePhoto":
    case "nonSmokerOnly":
    case "noDrugs":
      return !!value;
    case "petsOk": {
      if (value === "" || value === null || typeof value === "undefined") return null;
      // accept "true"/"false" strings from selects
      if (value === "true") return true;
      if (value === "false") return false;
      return !!value;
    }
    case "religion":
    case "education":
      return Array.isArray(value)
        ? value.filter(Boolean).map(String)
        : (value ? [String(value)] : []);
    default:
      return value;
  }
}

/**
 * Normalize a raw dealbreakers object from the server into the canonical shape.
 */
function normalizeDealbreakers(raw) {
  const base = { ...DEFAULT_DEALBREAKERS };
  if (!raw || typeof raw !== "object") return base;

  for (const k of Object.keys(base)) {
    base[k] = coerceValue(k, raw[k]);
  }
  return base;
}

/**
 * Build a PATCH payload by:
 *  - picking only allowed keys
 *  - coercing values to correct types
 *  - optionally removing unchanged values (to minimize payload)
 */
function buildPatch(payload = {}, prev = null) {
  const out = {};
  for (const k of Object.keys(payload || {})) {
    if (!ALLOWED_KEYS.has(k)) continue;
    const v = coerceValue(k, payload[k]);
    if (prev && typeof prev === "object" && k in prev) {
      // Only include if changed
      // Note: arrays compared by stringified value to avoid false positives
      const prevVal = Array.isArray(prev[k]) ? JSON.stringify(prev[k]) : prev[k];
      const nextVal = Array.isArray(v) ? JSON.stringify(v) : v;
      if (prevVal === nextVal) continue;
    }
    out[k] = v;
  }
  return out;
}

/** Small helper to standardize API errors. */
function toErrorObject(err) {
  const status = err?.response?.status || 0;
  const data = err?.response?.data || {};
  const message =
    data?.error ||
    data?.message ||
    err?.message ||
    "Request failed";
  return { status, message, data };
}

/**
 * Fetch current user's dealbreaker filters.
 * @returns {Promise<{
 *   dealbreakers: typeof DEFAULT_DEALBREAKERS
 * }>}
 */
export async function getDealbreakers() {
  try {
    const res = await api.get("/dealbreakers");
    const normalized = normalizeDealbreakers(res?.data?.dealbreakers);
    return normalized;
  } catch (err) {
    const e = toErrorObject(err);
    // For 401/403 we return defaults so UI still renders; caller can decide to show upgrade/login
    if (e.status === 401 || e.status === 403) return { ...DEFAULT_DEALBREAKERS };
    throw e;
  }
}

/**
 * Update dealbreaker filters (Premium-gated).
 * @param {Partial<typeof DEFAULT_DEALBREAKERS>} patch
 * @param {Partial<typeof DEFAULT_DEALBREAKERS>} [previous] Optional previous state for change-only patching
 * @returns {Promise<typeof DEFAULT_DEALBREAKERS>}
 */
export async function updateDealbreakers(patch, previous) {
  try {
    const body = buildPatch(patch || {}, previous || null);
    const res = await api.patch("/dealbreakers", body);
    return normalizeDealbreakers(res?.data?.dealbreakers);
  } catch (err) {
    const e = toErrorObject(err);
    // Surface premium gate with a stable shape the UI can branch on
    if (e.status === 403) {
      return Promise.reject({
        ...e,
        code: "FEATURE_LOCKED",
        feature: "dealbreakers",
      });
    }
    throw e;
  }
}

/**
 * Run a discover search with server-side application of dealbreakers.
 * @param {object} criteria Free-form search criteria (e.g., { q, limit, ... })
 * @returns {Promise<{ results: any[], appliedDealbreakers: typeof DEFAULT_DEALBREAKERS | null, premiumRequired?: boolean }>}
 */
export async function discoverWithDealbreakers(criteria = {}) {
  try {
    const res = await api.post("/discover/search", criteria);
    const data = res?.data || {};
    return {
      ...data,
      appliedDealbreakers: data?.appliedDealbreakers
        ? normalizeDealbreakers(data.appliedDealbreakers)
        : null,
      results: Array.isArray(data?.results) ? data.results : [],
    };
  } catch (err) {
    throw toErrorObject(err);
  }
}

/* Named export for defaults if the UI needs to reset form quickly without waiting for network */
export const DEALBREAKER_DEFAULTS = DEFAULT_DEALBREAKERS;
// --- REPLACE END ---
