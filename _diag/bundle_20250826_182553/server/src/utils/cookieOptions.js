// --- REPLACE START: Switch to pure ESM export for cookie options ---
/**
 * Centralized cookie options for refresh token cookie.
 * - In production: secure + sameSite 'none' (requires HTTPS)
 * - In dev/test:    secure false + sameSite 'lax'
 * Optionally support a shared parent domain via COOKIE_DOMAIN.
 *
 * NOTE:
 *  - Keep httpOnly true so JS cannot read the cookie.
 *  - Include maxAge so refresh cookie persists (default 30 days).
 */

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const MAX_AGE_DAYS = Number.isFinite(parseInt(process.env.REFRESH_COOKIE_MAX_DAYS, 10))
  ? parseInt(process.env.REFRESH_COOKIE_MAX_DAYS, 10)
  : 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Exported cookie options object.
 */
export const cookieOptions = {
  httpOnly: true,
  secure: isProd,                     // HTTPS only in production
  sameSite: isProd ? 'none' : 'lax',  // Lax in dev so cookies work on localhost
  path: '/',
  maxAge: MAX_AGE_MS,
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

// Provide both named and default exports for interop safety
export default cookieOptions;
// --- REPLACE END ---
