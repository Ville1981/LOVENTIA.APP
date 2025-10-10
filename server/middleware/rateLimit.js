// --- REPLACE START: lightweight, centralized rate limiters for sensitive routes ---
import rateLimit from 'express-rate-limit';

/**
 * Shared safe defaults
 * - Skip in test to avoid slowing CI.
 * - Standard headers only (no deprecated X-RateLimit-*).
 * - Simple JSON error body.
 */
function createLimiter({ windowMs, max, message = 'Too many requests, please try again later.' }) {
  const IS_TEST = process.env.NODE_ENV === 'test';
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => IS_TEST,
    message: { error: message },
    // Include user id in key when available, otherwise fall back to IP
    keyGenerator: (req) => {
      const uid = req.user?.id || req.user?._id;
      return uid ? `${req.ip || '0.0.0.0'}:${uid}` : (req.ip || '0.0.0.0');
    },
  });
}

/**
 * Auth endpoints can get hammered by bots -> slightly higher ceiling, longer window.
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // 100 auth hits per 15 min (per IP/user)
  message: 'Auth rate limit exceeded. Please wait a moment and try again.',
});

/**
 * Billing is more sensitive -> lower ceiling, shorter window.
 * Note: Stripe webhooks are NOT mounted under /api/billing, so webhook stays unaffected.
 */
export const billingLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,                 // 30 billing hits per 5 min
  message: 'Billing rate limit exceeded. Please wait a moment and try again.',
});

/**
 * Export factory in case you want to add more per-route limiters later.
 */
export { createLimiter as createRateLimiter };
// --- REPLACE END ---
