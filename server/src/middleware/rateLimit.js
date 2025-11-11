// PATH: server/src/middleware/rateLimit.js

// --- REPLACE START: unified, dependency-free rate limiters (ESM) ---
/**
 * Lightweight in-memory rate limiters for auth, billing, messages and generic API burst.
 * - No external dependencies (safe fallback for dev/CI; consider Redis in prod).
 * - Fixed-window counters per key (IP by default, can include route/method via env).
 * - Skips limiting when NODE_ENV=test or RATE_DISABLE=1 (to avoid CI flakiness).
 * - Emits best-effort X-RateLimit-* headers.
 *
 * Environment variables (all optional):
 *   RATE_DISABLE=1                   → disable all limiters (useful for CI)
 *   RATE_WINDOW_MS=60000             → window size in ms
 *   RATE_API_BURST_LIMIT=300         → /api/* generic limiter
 *   RATE_AUTH_LIMIT=60               → legacy auth limiter (kept for compatibility)
 *   RATE_AUTH_LOGIN_LIMIT=10         → POST /api/auth/login
 *   RATE_AUTH_REGISTER_LIMIT=5       → POST /api/auth/register
 *   RATE_BILLING_LIMIT=20            → /api/billing/*
 *   RATE_MESSAGES_LIMIT=60           → /api/messages/*
 *   RATE_KEY_INCLUDE_ROUTE=0|1       → include method + route (baseUrl+path) in key (default 0)
 *   RATE_SWEEP_THRESHOLD=10000       → when bucket count exceeds this, sweep expired entries
 */

const DISABLED =
  process.env.RATE_DISABLE === "1" || process.env.NODE_ENV === "test";

const WINDOW_MS = toNumber(process.env.RATE_WINDOW_MS, 60_000);

// Per-endpoint defaults (can be overridden via env)
const API_BURST_LIMIT     = toNumber(process.env.RATE_API_BURST_LIMIT, 300);
const AUTH_LIMIT          = toNumber(process.env.RATE_AUTH_LIMIT, 60); // legacy fallback
const AUTH_LOGIN_LIMIT    = toNumber(process.env.RATE_AUTH_LOGIN_LIMIT, 10);
const AUTH_REGISTER_LIMIT = toNumber(process.env.RATE_AUTH_REGISTER_LIMIT, 5);
const BILLING_LIMIT       = toNumber(process.env.RATE_BILLING_LIMIT, 20);
const MESSAGES_LIMIT      = toNumber(process.env.RATE_MESSAGES_LIMIT, 60);

const KEY_INCLUDE_ROUTE =
  (process.env.RATE_KEY_INCLUDE_ROUTE || "0").trim() === "1";

const SWEEP_THRESHOLD = Math.max(
  0,
  toNumber(process.env.RATE_SWEEP_THRESHOLD, 10_000)
);

/** Safe numeric parse with default. */
function toNumber(val, def) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

/**
 * Returns a stable key for the current request.
 * By default uses IP only; optionally includes METHOD + (baseUrl + path).
 */
function defaultKeyFn(req) {
  const ip =
    req.ip ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown";

  if (!KEY_INCLUDE_ROUTE) return ip;

  // Include method and route context for finer-grained limits when desired.
  const method = (req.method || "GET").toUpperCase();
  const route = `${req.baseUrl || ""}${req.path || req.url || ""}`;
  return `${ip} ${method} ${route}`;
}

/**
 * Factory: fixed-window in-memory rate limiter.
 * Map<key, { count: number, reset: number }>
 */
function createFixedWindowLimiter(
  limit,
  windowMs,
  name = "limiter",
  keyFn = defaultKeyFn
) {
  const buckets = new Map();

  function sweepIfNeeded(now) {
    if (!SWEEP_THRESHOLD || buckets.size < SWEEP_THRESHOLD) return;
    for (const [k, v] of buckets) {
      if (!v || typeof v.reset !== "number" || now >= v.reset) {
        buckets.delete(k);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    if (DISABLED) return next(); // no-op in tests/when disabled

    try {
      const now = Date.now();
      const key = keyFn(req);
      let bucket = buckets.get(key);

      if (!bucket || now >= bucket.reset) {
        bucket = { count: 0, reset: now + windowMs };
        buckets.set(key, bucket);
        // Opportunistic sweep when we open a new window for this key.
        sweepIfNeeded(now);
      }

      bucket.count += 1;

      // Best-effort standard headers
      const remaining = Math.max(0, limit - bucket.count);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.reset / 1000)));
      res.setHeader("X-RateLimit-Scope", name);

      if (bucket.count > limit) {
        // RFC-esque Retry-After (seconds)
        const retryAfterSec = Math.max(0, Math.ceil((bucket.reset - now) / 1000));
        res.setHeader("Retry-After", String(retryAfterSec));

        return res.status(429).json({
          error: "Too Many Requests",
          limit,
          remaining: 0,
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
export const apiBurstLimiter  = createFixedWindowLimiter(API_BURST_LIMIT, WINDOW_MS, "api");
export const authLimiter      = createFixedWindowLimiter(AUTH_LIMIT, WINDOW_MS, "auth-legacy");
export const loginLimiter     = createFixedWindowLimiter(AUTH_LOGIN_LIMIT, WINDOW_MS, "auth-login");
export const registerLimiter  = createFixedWindowLimiter(AUTH_REGISTER_LIMIT, WINDOW_MS, "auth-register");
export const billingLimiter   = createFixedWindowLimiter(BILLING_LIMIT, WINDOW_MS, "billing");
export const messagesLimiter  = createFixedWindowLimiter(MESSAGES_LIMIT, WINDOW_MS, "messages");

/** Default export (bundle style). */
export default {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};
// --- REPLACE END ---


