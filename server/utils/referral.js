// ESM referral helpers used by referral routes/middleware

export const REF_COOKIE = process.env.REFERRAL_COOKIE_NAME || "lv_ref";

/** Normalizes a referral code string */
export function normalizeCode(code) {
  return (code ?? "").toString().trim();
}

/** Extract code from query (?ref=CODE) */
export function parseRefFromQuery(req) {
  const raw = req?.query?.ref ?? req?.query?.code ?? null;
  const val = normalizeCode(raw);
  return val || null;
}

/** Name of the cookie where the referral code is stored */
export function getReferralCookieName() {
  return REF_COOKIE;
}

/** Set HTTP-only cookie for referral attribution */
export function setReferralCookie(res, code, days = 30) {
  if (!res || !code) return;
  const maxAge = Math.max(1, days) * 24 * 60 * 60 * 1000;
  res.cookie(REF_COOKIE, normalizeCode(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

/** Clear referral cookie */
export function clearReferralCookie(res) {
  if (!res) return;
  // match options used at set time (except maxAge)
  res.clearCookie(REF_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Optional: generate a simple referral code (fallback) */
export function generateReferralCode(seed = "") {
  // very small, dependency-free fallback
  const base =
    seed && typeof seed === "string"
      ? seed.replace(/[^a-z0-9]/gi, "").slice(-6)
      : "";
  const rnd = Math.random().toString(36).slice(2, 8);
  return (base + rnd).slice(0, 10).toUpperCase();
}

/** Alias for legacy import in routes: codeFromUserId(...) */
export const codeFromUserId = generateReferralCode;

/** No-op persistence helpers (replace with DB logic if needed) */
export async function saveAttribution(/* req, userId, code */) {
  // Implement DB write here if your referral flow needs it.
  return true;
}
export async function loadAttribution(/* userId */) {
  // Implement DB read here if your referral flow needs it.
  return null;
}

// Default export for compatibility if someone imports default
export default {
  REF_COOKIE,
  normalizeCode,
  parseRefFromQuery,
  getReferralCookieName,
  setReferralCookie,
  clearReferralCookie,
  generateReferralCode,
  codeFromUserId,       // <- mukana myös defaultissa
  saveAttribution,
  loadAttribution,
};
