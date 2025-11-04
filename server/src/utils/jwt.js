// PATH: server/src/utils/jwt.js

// --- REPLACE START: Centralized JWT helpers with env-driven TTLs, aliases, and full id packing ---
/**
 * Centralized JWT helpers (ESM).
 * =================================
 *
 * Goal:
 * - ONE place where we sign/verify JWTs
 * - SAME secret priority as in:
 *     - server/src/utils/generateTokens.js
 *     - server/src/api/controllers/authController.js
 *     - server/routes/auth.js
 * - ALWAYS pack ALL id fields into the token:
 *     sub, id, userId, uid
 *   (this is the exact thing we are fixing now, so discover, uploads,
 *    /api/auth/me, private routes, and PS scripts all see the same field)
 *
 * What this file exports:
 *   signAccessToken(userOrPayload, opts?)
 *   signRefreshToken(userOrPayload, opts?)
 *   verifyAccess(token, opts?)
 *   verifyRefresh(token, opts?)
 *   decode(token)
 *
 * Backward-compatible aliases:
 *   generateAccessToken  -> signAccessToken
 *   generateRefreshToken -> signRefreshToken
 *
 * Notes:
 * - We still TRY to read from ../config/env.js if it exists, but we do NOT
 *   depend on it — we also read from process.env directly.
 * - We do NOT crash if secrets are missing; we log once and use dev fallbacks.
 * - All comments are in English for future debugging.
 */

import jwt from "jsonwebtoken";

// Try to load central env config, but don't blow up if missing
// (some repos don't have server/src/config/env.js at all).
let envConfig = {};
try {
  // eslint-disable-next-line import/no-unresolved
  const mod = await import("../config/env.js");
  envConfig = mod?.default || mod || {};
} catch {
  // ignore – we will read from process.env below
}

/**
 * Secret priority (MUST match other auth files!)
 * Access token:
 *   1) envConfig.JWT_SECRET
 *   2) process.env.JWT_SECRET
 *   3) process.env.ACCESS_TOKEN_SECRET
 *   4) "dev_access_secret"
 *
 * Refresh token:
 *   1) envConfig.REFRESH_TOKEN_SECRET
 *   2) process.env.JWT_REFRESH_SECRET
 *   3) process.env.REFRESH_TOKEN_SECRET
 *   4) "dev_refresh_secret"
 */
const ACCESS_SECRET =
  envConfig.JWT_SECRET ||
  process.env.JWT_SECRET ||
  process.env.ACCESS_TOKEN_SECRET ||
  "dev_access_secret";

const REFRESH_SECRET =
  envConfig.REFRESH_TOKEN_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  process.env.REFRESH_TOKEN_SECRET ||
  "dev_refresh_secret";

/**
 * TTL (time to live) priorities
 */
const ACCESS_TTL =
  envConfig.ACCESS_TOKEN_EXPIRES ||
  process.env.ACCESS_TOKEN_EXPIRES ||
  process.env.JWT_EXPIRES_IN ||
  "2h";

const REFRESH_TTL =
  envConfig.REFRESH_TOKEN_EXPIRES ||
  process.env.REFRESH_TOKEN_EXPIRES ||
  process.env.JWT_REFRESH_EXPIRES_IN ||
  "30d";

/**
 * Issuer (optional)
 */
const TOKEN_ISSUER =
  envConfig.TOKEN_ISSUER || process.env.TOKEN_ISSUER || "loventia-api";

/** Log once if secrets are missing (don’t crash dev). */
let _warned = false;
function ensureSecrets() {
  const hasAccess = !!ACCESS_SECRET;
  const hasRefresh = !!REFRESH_SECRET;
  if ((!hasAccess || !hasRefresh) && !_warned) {
    console.error(
      "[jwt] Missing JWT secrets. Using DEV fallbacks. Set JWT_SECRET and JWT_REFRESH_SECRET or REFRESH_TOKEN_SECRET."
    );
    _warned = true;
  }
}

/**
 * Helper: normalize any kind of id to a string.
 */
function normalizeId(any) {
  if (!any) return "";
  if (typeof any === "string") return any;
  if (typeof any === "number") return String(any);
  if (typeof any.toString === "function") return any.toString();
  return "";
}

/**
 * Core helper: turn a user or (partial) payload into the FINAL JWT payload.
 *
 * We FORCE all id fields:
 *   sub, id, userId, uid
 *
 * Reason:
 * - older tokens only had `userId`
 * - some middleware expected `sub`
 * - some DB utils expected `_id`
 * - some PS scripts used `uid`
 *
 * After this change, **all** of them will work with the same token.
 */
function toPayload(obj = {}) {
  // If someone already passed a payload that looks ready → just enforce ids.
  if (obj && typeof obj === "object" && (obj.sub || obj.id || obj.userId || obj.uid)) {
    const forcedId = normalizeId(
      obj.sub || obj.id || obj.userId || obj.uid || obj._id
    );
    const isPremium =
      obj.isPremium === true ||
      obj.premium === true ||
      (obj.entitlements && obj.entitlements.tier === "premium");

    return {
      ...obj,
      sub: forcedId,
      id: forcedId,
      userId: forcedId,
      uid: forcedId,
      isPremium,
      premium: isPremium,
    };
  }

  // If we got a plain user doc
  const rawId =
    obj._id ||
    obj.id ||
    obj.userId ||
    obj.uid ||
    (obj.user && (obj.user._id || obj.user.id));
  const id = normalizeId(rawId);

  const isPremium =
    obj.isPremium === true ||
    obj.premium === true ||
    (obj.entitlements && obj.entitlements.tier === "premium");

  const payload = {
    sub: id || "anon",
    id: id || "anon",
    userId: id || "anon",
    uid: id || "anon",
    email: obj.email || null,
    role: obj.role || "user",
    isPremium,
    premium: isPremium,
  };

  if (obj.entitlements && typeof obj.entitlements === "object") {
    payload.entitlements = {
      tier: obj.entitlements.tier || (isPremium ? "premium" : "free"),
    };
  }

  return payload;
}

/**
 * Sign an access token.
 *
 * Example:
 *   const token = signAccessToken(user)              // uses default TTL
 *   const token = signAccessToken(user, { expiresIn: '15m' })
 */
export function signAccessToken(userOrPayload, opts = {}) {
  ensureSecrets();
  const payload = toPayload(userOrPayload);
  const expiresIn = opts.expiresIn || ACCESS_TTL;

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn,
    issuer: TOKEN_ISSUER,
  });
}

/**
 * Sign a refresh token.
 *
 * We also add `type: "refresh"` so routes can quickly detect non-refresh tokens.
 */
export function signRefreshToken(userOrPayload, opts = {}) {
  ensureSecrets();
  const payload = {
    ...toPayload(userOrPayload),
    type: "refresh",
  };
  const expiresIn = opts.expiresIn || REFRESH_TTL;

  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn,
    issuer: TOKEN_ISSUER,
  });
}

/**
 * Verify access token — throws on error.
 * Usage:
 *   const decoded = verifyAccess(token);
 */
export function verifyAccess(token, opts = {}) {
  ensureSecrets();
  const decoded = jwt.verify(token, ACCESS_SECRET, {
    issuer: TOKEN_ISSUER,
    ...opts,
  });
  // normalize on the way out too (in case legacy token had only userId)
  return toPayload(decoded);
}

/**
 * Verify refresh token — throws on error.
 * Usage:
 *   const decoded = verifyRefresh(token);
 */
export function verifyRefresh(token, opts = {}) {
  ensureSecrets();
  const decoded = jwt.verify(token, REFRESH_SECRET, {
    issuer: TOKEN_ISSUER,
    ...opts,
  });
  return toPayload(decoded);
}

/**
 * Non-verifying decode (diagnostics only).
 */
export function decode(token) {
  const decoded = jwt.decode(token, { complete: false });
  if (!decoded) return null;
  return toPayload(decoded);
}

/* ---------------------------- Backward-compat API --------------------------- */
/**
 * Older code may still do:
 *   import { generateAccessToken } from '../utils/jwt.js'
 */
export const generateAccessToken = signAccessToken;
export const generateRefreshToken = signRefreshToken;

/**
 * Default export for convenience.
 * This allows:
 *   import jwtUtil from '../utils/jwt.js';
 *   jwtUtil.signAccessToken(...);
 */
export default {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
  decode,
  // aliases
  generateAccessToken,
  generateRefreshToken,
};
// --- REPLACE END ---


