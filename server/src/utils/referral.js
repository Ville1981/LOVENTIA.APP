// File: server/src/utils/referral.js

// --- REPLACE START: tiny helper to derive stable short referral codes from userId ---
/**
 * Deterministic short code from Mongo ObjectId (or any string).
 * - Not cryptographically secure; intended only for referral tags.
 * - Reversible only on server side if you store mapping (optional).
 */
export function codeFromUserId(userId = '') {
  if (!userId || typeof userId !== 'string') return '';
  // create a short, consistent code: base36 of a simple hash
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  const unsigned = h >>> 0; // convert to uint32
  return unsigned.toString(36); // short, URL-friendly
}

export function buildReferralUrl(baseClientUrl, code) {
  if (!baseClientUrl || !code) return '';
  const u = new URL(baseClientUrl);
  // Append ?ref=
  u.searchParams.set('ref', code);
  return u.toString();
}
// --- REPLACE END ---
