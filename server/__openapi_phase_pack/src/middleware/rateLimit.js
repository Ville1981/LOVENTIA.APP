// PATH: server/src/middleware/rateLimit.js

// --- REPLACE START: unified, dependency-free rate limiters (ESM) ---
/**
 * Lightweight in-memory rate limiters for auth, billing, messages and generic API burst.
 * - No external dependencies (safe fallback for dev/CI; consider Redis in prod).
 * - Fixed-window counters per key (IP by default).
 * - Skips limiting when NODE_ENV=test or RATE_DISABLE=1 (to avoid CI flakiness).
 * - Emits basic X-RateLimit-* headers.
 *
 * Environment variables (all optional):
 *   RATE_DISABLE=1                 → disable all limiters
 *   RATE_WINDOW_MS=60000           → window size in ms
 *   RATE_API_BURST_LIMIT=300       → /api/* generic limiter
 *   RATE_AUTH_LIMIT=60             → legacy auth limiter (kept for compatibility)
 *   RATE_AUTH_LOGIN_LIMIT=10       → POST /api/auth/login
 *   RATE_AUTH_REGISTER_LIMIT=5     → POST /api/auth/register
 *   RATE_BILLING_LIMIT=20          → /api/billing/*
 *   RATE_MESSAGES_LIMIT=60         → /api/messages/*
 */

const DISABLED = process.env.RATE_DISABLE === "1" || process.env.NODE_ENV === "test";
const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);

// Per-endpoint defaults (can be overridden via env)
const API_BURST_LIMIT       = Number(process.env.RATE_API_BURST_LIMIT || 300);
const AUTH_LIMIT            = Number(process.env.RATE_AUTH_LIMIT || 60); // legacy fallback
const AUTH_LOGIN_LIMIT      = Number(process.env.RATE_AUTH_LOGIN_LIMIT || 10);
const AUTH_REGISTER_LIMIT   = Number(process.env.RATE_AUTH_REGISTER_LIMIT || 5);
const BILLING_LIMIT         = Number(process.env.RATE_BILLING_LIMIT || 20);
const MESSAGES_LIMIT        = Number(process.env.RATE_MESSAGES_LIMIT || 60);

/**
 * Returns a stable key for the current request.
 * Defaults to IP-based key; can be extended to include route/method if needed.
 */
function defaultKeyFn(req) {
  // Express sets req.ip when 'trust proxy' is configured; fall back to connection address
  return req.ip || req.connection?.remoteAddress || "unknown";
}

/**
 * Factory: fixed-window in-memory rate limiter.
 * @param {number} limit - max requests per window per key
 * @param {number} windowMs - window size in ms
 * @param {string} name - scope name for diagnostics
 * @param {(req: any) => string} [keyFn] - function to derive key (default: IP)
 */
function createFixedWindowLimiter(limit, windowMs, name = "limiter", keyFn = defaultKeyFn) {
  // Map<key, { count: number, reset: number }>
  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    if (DISABLED) return next(); // no-op in tests/when disabled

    try {
      const now = Date.now();
      const key = keyFn(req);
      let bucket = buckets.get(key);

      if (!bucket || now >= bucket.reset) {
        bucket = { count: 0, reset: now + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;

      // Best-effort standard headers
      const remaining = Math.max(0, limit - bucket.count);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.reset / 1000)));
      res.setHeader("X-RateLimit-Scope", name);

      if (bucket.count > limit) {
        return res.status(429).json({
          error: "Too Many Requests",
          limit,
          reset: bucket.reset,
          scope: name,
        });
      }

      return next();
    } catch {
      // Never block requests due to limiter internals
      return next();
    }
  };
}

/**
 * Named limiters exported for targeted mounting in app.js
 * Keep legacy `authLimiter` for backward compatibility (generic auth surface).
 */
export const apiBurstLimiter   = createFixedWindowLimiter(API_BURST_LIMIT, WINDOW_MS, "api");
export const authLimiter       = createFixedWindowLimiter(AUTH_LIMIT, WINDOW_MS, "auth-legacy");
export const loginLimiter      = createFixedWindowLimiter(AUTH_LOGIN_LIMIT, WINDOW_MS, "auth-login");
export const registerLimiter   = createFixedWindowLimiter(AUTH_REGISTER_LIMIT, WINDOW_MS, "auth-register");
export const billingLimiter    = createFixedWindowLimiter(BILLING_LIMIT, WINDOW_MS, "billing");
export const messagesLimiter   = createFixedWindowLimiter(MESSAGES_LIMIT, WINDOW_MS, "messages");

/**
 * Default export for convenience when importing as a bundle.
 */
export default {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};
// --- REPLACE END ---


