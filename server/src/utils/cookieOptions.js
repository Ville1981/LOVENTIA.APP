// PATH: server/src/utils/cookieOptions.js

// --- REPLACE START: Centralized cookie options with .env overrides (ESM) ---
/**
 * Centralized cookie options for auth refresh cookie and other auth cookies.
 *
 * Defaults (can be overridden via .env):
 *   - Development (NODE_ENV !== 'production'):
 *       httpOnly = true
 *       sameSite = 'Lax'
 *       secure   = false
 *       path     = '/api/auth'
 *
 *   - Production (NODE_ENV === 'production'):
 *       httpOnly = true
 *       sameSite = 'Strict'   // can be changed via COOKIE_SAMESITE (e.g. 'None' for cross-site)
 *       secure   = true
 *       path     = '/api/auth'
 *
 * .env overrides:
 *   - COOKIE_SAMESITE = 'Lax' | 'Strict' | 'None' (case-insensitive)
 *   - COOKIE_SECURE   = 'true' | 'false'
 *   - COOKIE_PATH     = any string path (e.g. '/api/auth' or '/')
 *   - COOKIE_DOMAIN   = optional domain (e.g. '.example.com')  ← only if you need it
 *
 * Notes:
 *   - We intentionally DO NOT set maxAge here to keep controllers free to decide
 *     per-cookie lifetime (e.g. 7 days for refresh, session-only for others).
 *   - Keep httpOnly=true so JS cannot read the cookie.
 *   - If you set SameSite='None' you MUST also set Secure=true for modern browsers.
 */

const isProd = process.env.NODE_ENV === 'production';

/* -------------------------------------------------------------------------- */
/*                             Helpers & normalizers                           */
/* -------------------------------------------------------------------------- */

/**
 * Normalize SameSite values to the canonical casing accepted by Express:
 *   'lax'|'Lax'   → 'Lax'
 *   'strict'      → 'Strict'
 *   'none'        → 'None'
 * Falls back to provided fallback if unknown.
 */
function normalizeSameSite(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'lax') return 'Lax';
  if (v === 'strict') return 'Strict';
  if (v === 'none') return 'None';
  return fallback;
}

/**
 * Parse a boolean-like env string. Returns undefined if not set.
 */
function parseEnvBool(str) {
  if (typeof str !== 'string' || !str.trim()) return undefined;
  const v = str.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*                           Base defaults (dev/prod)                          */
/* -------------------------------------------------------------------------- */

const baseDev = {
  httpOnly: true,
  sameSite: 'Lax',
  secure: false,
  path: '/api/auth',
  // domain: undefined
};

const baseProd = {
  httpOnly: true,
  sameSite: 'Strict',
  secure: true,
  path: '/api/auth',
  // domain: undefined
};

let cookieOptions = isProd ? { ...baseProd } : { ...baseDev };

/* -------------------------------------------------------------------------- */
/*                        Apply .env overrides when provided                   */
/* -------------------------------------------------------------------------- */

const ENV_SAMESITE = process.env.COOKIE_SAMESITE;
const ENV_PATH     = process.env.COOKIE_PATH;
const ENV_SECURE   = parseEnvBool(process.env.COOKIE_SECURE);
const ENV_DOMAIN   = process.env.COOKIE_DOMAIN;

// Path override
if (typeof ENV_PATH === 'string' && ENV_PATH.trim()) {
  cookieOptions.path = ENV_PATH.trim();
}

// Secure override
if (typeof ENV_SECURE === 'boolean') {
  cookieOptions.secure = ENV_SECURE;
}

// SameSite override
if (typeof ENV_SAMESITE === 'string' && ENV_SAMESITE.trim()) {
  cookieOptions.sameSite = normalizeSameSite(ENV_SAMESITE, cookieOptions.sameSite);
}

// Domain override (optional)
if (typeof ENV_DOMAIN === 'string' && ENV_DOMAIN.trim()) {
  cookieOptions.domain = ENV_DOMAIN.trim();
}

// Ensure canonical casing for SameSite
cookieOptions.sameSite = normalizeSameSite(cookieOptions.sameSite, isProd ? 'Strict' : 'Lax');

// Guard: SameSite=None implies Secure=true for modern browsers.
// Only auto-fix if user did not explicitly force COOKIE_SECURE=false.
if (cookieOptions.sameSite === 'None' && typeof ENV_SECURE !== 'boolean') {
  cookieOptions.secure = true;
}

/* -------------------------------------------------------------------------- */
/*                         Exported API (named + default)                      */
/* -------------------------------------------------------------------------- */

/**
 * The shared, environment-aware cookie options object.
 * Controllers can spread this and add `maxAge` per cookie:
 *   res.cookie('refreshToken', token, { ...cookieOptions, maxAge: 7*24*60*60*1000 });
 */
export const authCookieOptions = cookieOptions;

/**
 * Helper to compose options with a maxAge in milliseconds, without mutating the base.
 */
export function withMaxAge(ms) {
  const n = Number(ms);
  return Number.isFinite(n) ? { ...authCookieOptions, maxAge: n } : { ...authCookieOptions };
}

// Backward-compatible default export
export default authCookieOptions;
// --- REPLACE END ---
