// PATH: server/src/utils/jwt.js

// --- REPLACE START: Centralized JWT helpers with env-driven TTLs, aliases, and verifies ---
/**
 * Centralized JWT helpers (ESM).
 * - Reads secrets & TTLs from config/env.js (with safe fallbacks).
 * - Exports:
 *     signAccessToken(userOrPayload, opts?)
 *     signRefreshToken(userOrPayload, opts?)
 *     verifyAccess(token, opts?)
 *     verifyRefresh(token, opts?)
 *     decode(token)
 *   Aliases (for backward-compat):
 *     generateAccessToken  -> signAccessToken
 *     generateRefreshToken -> signRefreshToken
 *
 * Env via config/env.js:
 *   JWT_SECRET                (required)
 *   REFRESH_TOKEN_SECRET      (required)
 *   ACCESS_TOKEN_EXPIRES      default '2h'
 *   REFRESH_TOKEN_EXPIRES     default '30d'
 *   TOKEN_ISSUER              default 'loventia-api' (optional; read here directly)
 */

import jwt from 'jsonwebtoken';
import {
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
} from '../config/env.js';

const TOKEN_ISSUER = process.env.TOKEN_ISSUER || 'loventia-api';

// Normalize TTLs with safe fallbacks in case config/env.js omits them.
const ACCESS_TTL  = ACCESS_TOKEN_EXPIRES  || '2h';
const REFRESH_TTL = REFRESH_TOKEN_EXPIRES || '30d';

/** Log once if secrets are missing (don’t crash dev). */
let _warned = false;
function ensureSecrets() {
  const ok = !!(JWT_SECRET && REFRESH_TOKEN_SECRET);
  if (!ok && !_warned) {
    console.error('[jwt] Missing JWT secrets. Set JWT_SECRET and REFRESH_TOKEN_SECRET.');
    _warned = true;
  }
  return ok;
}

/** Convert a user or payload into minimal JWT payload shape. */
function toPayload(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const id = obj.userId
    || obj.id
    || (obj._id && typeof obj._id.toString === 'function' ? obj._id.toString() : undefined);
  const role = obj.role || 'user';
  return id ? { userId: id, role } : { role, ...obj };
}

/** Sign an access token. opts.expiresIn can override (e.g., '10m'). */
export function signAccessToken(userOrPayload, opts = {}) {
  ensureSecrets();
  const payload   = toPayload(userOrPayload);
  const expiresIn = opts.expiresIn || ACCESS_TTL;
  return jwt.sign(payload, JWT_SECRET, { expiresIn, issuer: TOKEN_ISSUER });
}

/** Sign a refresh token. opts.expiresIn can override (e.g., '7d'). */
export function signRefreshToken(userOrPayload, opts = {}) {
  ensureSecrets();
  const payload   = toPayload(userOrPayload);
  const expiresIn = opts.expiresIn || REFRESH_TTL;
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn, issuer: TOKEN_ISSUER });
}

/** Verify helpers (throw on error). */
export function verifyAccess(token, opts = {}) {
  ensureSecrets();
  return jwt.verify(token, JWT_SECRET, { issuer: TOKEN_ISSUER, ...opts });
}

export function verifyRefresh(token, opts = {}) {
  ensureSecrets();
  return jwt.verify(token, REFRESH_TOKEN_SECRET, { issuer: TOKEN_ISSUER, ...opts });
}

/** Non-verifying decode (diagnostics only). */
export function decode(token) {
  return jwt.decode(token, { complete: false });
}

/* ---------------------------- Backward-compat API --------------------------- */
/** Aliases so older imports keep working without code changes elsewhere. */
export const generateAccessToken  = signAccessToken;
export const generateRefreshToken = signRefreshToken;

/** Default export for convenience. */
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
