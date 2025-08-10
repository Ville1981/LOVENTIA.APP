// --- REPLACE START: Switch to pure ESM export for cookie options ---
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
export const cookieOptions = {
  httpOnly: true,
  secure: isProd,                   // HTTPS only in production
  sameSite: isProd ? 'none' : 'lax',// Lax in dev so cookies work on localhost
  path: '/',
  // Add domain only if provided (avoids setting a wrong domain locally)
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};
// --- REPLACE END ---
