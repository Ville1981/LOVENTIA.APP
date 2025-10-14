// PATH: server/src/middleware/rateLimit.js

/**
 * Lightweight in-memory rate limiters for auth and billing routes.
 * No external dependencies. Good enough as a safe fallback.
 * Uses per-IP counters with a simple fixed window.
 */

const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);

// Per-endpoint defaults (can be overridden with env)
const AUTH_LIMIT    = Number(process.env.RATE_AUTH_LIMIT    || 60);  // e.g., 60 req / min per IP
const BILLING_LIMIT = Number(process.env.RATE_BILLING_LIMIT || 30);  // e.g., 30 req / min per IP

function createFixedWindowLimiter(limit, windowMs, name = "limiter") {
  // Map<key, { count, reset }>
  const buckets = new Map();

  return function (req, res, next) {
    try {
      const now = Date.now();
      const ip = req.ip || req.connection?.remoteAddress || "unknown";
      let b = buckets.get(ip);

      if (!b || now >= b.reset) {
        b = { count: 0, reset: now + windowMs };
        buckets.set(ip, b);
      }

      b.count += 1;

      // Set basic headers (best-effort)
      const remaining = Math.max(0, limit - b.count);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(b.reset / 1000)));

      if (b.count > limit) {
        return res.status(429).json({
          error: "Too Many Requests",
          limit,
          reset: b.reset,
          scope: name,
        });
      }

      return next();
    } catch {
      // Never block on limiter errors
      return next();
    }
  };
}

// Export two named middlewares
export const authLimiter = createFixedWindowLimiter(AUTH_LIMIT, WINDOW_MS, "auth");
export const billingLimiter = createFixedWindowLimiter(BILLING_LIMIT, WINDOW_MS, "billing");

export default {
  authLimiter,
  billingLimiter,
};
