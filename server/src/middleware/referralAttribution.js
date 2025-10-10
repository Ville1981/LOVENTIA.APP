// File: server/src/middleware/referralAttribution.js

// --- REPLACE START: middleware to capture ?ref= and persist in a cookie (30 days) ---
/**
 * Captures `?ref=CODE` on any request and persists it to an HTTP-only cookie.
 * - Safe to mount globally; no body parsing needed.
 * - Cookie name: `lv_ref`
 */
export default function referralAttribution(options = {}) {
  const {
    cookieName = 'lv_ref',
    maxAgeDays = 30,
    cookieDomain = undefined, // set if you need cross-subdomain sharing
    sameSite = 'Lax',
    secure = undefined, // default based on NODE_ENV
  } = options;

  return function refAttr(req, res, next) {
    try {
      const code = req.query?.ref;
      if (typeof code === 'string' && code.trim().length > 0) {
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const isProd = process.env.NODE_ENV === 'production';
        res.cookie(cookieName, code.trim(), {
          httpOnly: true,
          sameSite,
          secure: secure ?? isProd,
          domain: cookieDomain,
          maxAge: maxAgeMs,
          path: '/',
        });
      }
    } catch {
      // no-op
    }
    next();
  };
}
// --- REPLACE END ---
