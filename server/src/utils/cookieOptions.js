// --- REPLACE START: switch to CommonJS so Jest can require() this without ESM support ---
'use strict';

/**
 * Centralized cookie options for refresh token cookie.
 * - In production: secure + sameSite 'none' (requires HTTPS)
 * - In dev/test:    secure false + sameSite 'lax'
 * Optionally support a shared parent domain via COOKIE_DOMAIN.
 */
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/**
 * Exported cookie options object.
 * NOTE: Keep httpOnly true so JS cannot read the cookie.
 */
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  // Add domain only if provided (avoids setting a wrong domain locally)
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

module.exports = { cookieOptions };
// --- REPLACE END ---
