// File: client/src/api/dealbreakers.js
// --- REPLACE START: client API stub for dealbreakers ---
import api from "./index";

/**
 * Fetch current user's dealbreaker filters.
 */
export async function getDealbreakers() {
  const res = await api.get("/dealbreakers");
  return res?.data?.dealbreakers ?? null;
}

/**
 * Update dealbreaker filters (Premium-gated).
 * `patch` should contain only allowed fields, e.g.:
 * { distanceKm: 10, ageMin: 25, ageMax: 40, mustHavePhoto: true }
 */
export async function updateDealbreakers(patch) {
  const res = await api.patch("/dealbreakers", patch || {});
  return res?.data?.dealbreakers ?? null;
}

/**
 * Run a discover search with server-side application of dealbreakers.
 * This is a stub call that returns server's stubbed results.
 */
export async function discoverWithDealbreakers(criteria = {}) {
  const res = await api.post("/discover/search", criteria);
  return res?.data ?? { results: [] };
}
// --- REPLACE END ---
