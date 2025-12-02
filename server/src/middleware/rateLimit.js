// PATH: server/src/middleware/rateLimit.js

// --- REPLACE START: unified, dependency-free rate limiters (ESM) ---
/**
 * Lightweight in-memory rate limiters for auth, billing, messages and generic API burst.
 *
 * Key properties:
 * - No external dependencies (safe fallback for dev/CI; consider Redis in real prod).
 * - Fixed-window counters per key (IP by default, can include route/method via env).
 * - Skips limiting when NODE_ENV=test or RATE_DISABLE=1 (to avoid CI flakiness).
 * - Emits best-effort X-RateLimit-* headers and a consistent JSON 429 body.
 * - On 429, logs a structured JSON entry via logger with scope="rate-limit".
 *
 * Environment variables (all optional, with defaults in parentheses):
 *
 *   RATE_DISABLE=1                      → disable all limiters (useful for CI)
 *   RATE_WINDOW_MS=60000               → window size in ms (default 60000 = 60s)
 *
 *   RATE_API_BURST_LIMIT=300           → /api/* generic limiter
 *       - scope name: "api"
 *       - default: 300 requests / 60s per key
 *
 *   RATE_AUTH_LIMIT=60                 → legacy auth limiter (kept for compatibility)
 *       - scope name: "auth-legacy"
 *       - mounted on more generic auth surface if needed
 *
 *   RATE_AUTH_LOGIN_LIMIT=10           → POST /api/auth/login
 *       - scope name: "auth-login"
 *       - default: 10 login attempts / 60s per key
 *
 *   RATE_AUTH_REGISTER_LIMIT=5         → POST /api/auth/register
 *       - scope name: "auth-register"
 *       - default: 5 registrations / 60s per key
 *
 *   RATE_BILLING_LIMIT=20              → /api/billing/*
 *       - scope name: "billing"
 *       - default: 20 billing-related calls / 60s per key
 *
 *   RATE_MESSAGES_LIMIT=60             → /api/messages/*
 *       - scope name: "messages"
 *       - default: 60 messaging calls / 60s per key
 *
 *   RATE_KEY_INCLUDE_ROUTE=0|1         → include method + route (baseUrl+path) in key (default 0 = IP only)
 *   RATE_SWEEP_THRESHOLD=10000         → when bucket count exceeds this, sweep expired entries
 *
 * Mapping in app.js (for reference):
 *   app.use("/api/auth/login",   loginLimiter);     // "auth-login"
 *   app.use("/api/auth/register", registerLimiter); // "auth-register"
 *   app.use("/api/auth/refresh", authLimiter);      // "auth-legacy"
 *   app.use("/api/billing",      billingLimiter);   // "billing"
 *   app.use("/api/messages",     messagesLimiter);  // "messages"
 *   app.use("/api",              apiBurstLimiter);  // "api"
 */

import logger from "../utils/logger.js";

const DISABLED =
  process.env.RATE_DISABLE === "1" || process.env.NODE_ENV === "test";

/** Safe numeric parse with default. */
function toNumber(val, def) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

const WINDOW_MS = toNumber(process.env.RATE_WINDOW_MS, 60_000);

// Per-endpoint defaults (can be overridden via env)
const API_BURST_LIMIT = toNumber(process.env.RATE_API_BURST_LIMIT, 300);
const AUTH_LIMIT = toNumber(process.env.RATE_AUTH_LIMIT, 60); // legacy fallback
const AUTH_LOGIN_LIMIT = toNumber(process.env.RATE_AUTH_LOGIN_LIMIT, 10);
const AUTH_REGISTER_LIMIT = toNumber(process.env.RATE_AUTH_REGISTER_LIMIT, 5);
const BILLING_LIMIT = toNumber(process.env.RATE_BILLING_LIMIT, 20);
const MESSAGES_LIMIT = toNumber(process.env.RATE_MESSAGES_LIMIT, 60);

const KEY_INCLUDE_ROUTE =
  (process.env.RATE_KEY_INCLUDE_ROUTE || "0").trim() === "1";

const SWEEP_THRESHOLD = Math.max(
  0,
  toNumber(process.env.RATE_SWEEP_THRESHOLD, 10_000)
);

/**
 * Returns the best-effort client IP.
 */
function getClientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

/**
 * Returns a stable key for the current request.
 * By default uses IP only; optionally includes METHOD + (baseUrl + path).
 */
function defaultKeyFn(req) {
  const ip = getClientIp(req);

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
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.floor(bucket.reset / 1000))
      );
      res.setHeader("X-RateLimit-Scope", name);
      res.setHeader("X-RateLimit-Impl", "src-fixed-window-v1");

      if (bucket.count > limit) {
        // RFC-esque Retry-After (seconds)
        const retryAfterSec = Math.max(
          0,
          Math.ceil((bucket.reset - now) / 1000)
        );
        res.setHeader("Retry-After", String(retryAfterSec));

        const payload = {
          error: "Too Many Requests",
          code: "RATE_LIMITED",
          message: "Too many requests, please slow down.",
          limit,
          remaining: 0,
          reset: bucket.reset, // unix ms timestamp (ms)
          scope: name,
        };

        // Structured logging for rate limits
        try {
          const ip = getClientIp(req);
          const requestId = req.requestId || res.locals?.requestId;
          const user = req.user || {};
          const auth = req.auth || {};
          logger.warn({
            scope: "rate-limit",
            limiter: name,
            method: (req.method || "GET").toUpperCase(),
            path: req.originalUrl || req.url || "",
            ip,
            requestId,
            userId:
              req.userId ||
              user.id ||
              user._id ||
              auth.userId ||
              auth.id ||
              auth.sub ||
              null,
            limit,
            remaining: 0,
            reset: bucket.reset,
          });
        } catch {
          // Never break the response because of logging failures
        }

        // Unified JSON 429 body so clients (and PS smoketests) always see a
        // consistent structure instead of an empty body or plain "429".
        res.status(429);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify(payload));
      }

      return next();
    } catch {
      // Never block requests due to limiter internals
      return next();
    }
  };
}

/**
 * Named limiters exported for targeted mounting.
 * Keep legacy `authLimiter` for backward compatibility (generic auth surface).
 */
export const apiBurstLimiter = createFixedWindowLimiter(
  API_BURST_LIMIT,
  WINDOW_MS,
  "api"
);

export const authLimiter = createFixedWindowLimiter(
  AUTH_LIMIT,
  WINDOW_MS,
  "auth-legacy"
);

export const loginLimiter = createFixedWindowLimiter(
  AUTH_LOGIN_LIMIT,
  WINDOW_MS,
  "auth-login"
);

export const registerLimiter = createFixedWindowLimiter(
  AUTH_REGISTER_LIMIT,
  WINDOW_MS,
  "auth-register"
);

export const billingLimiter = createFixedWindowLimiter(
  BILLING_LIMIT,
  WINDOW_MS,
  "billing"
);

export const messagesLimiter = createFixedWindowLimiter(
  MESSAGES_LIMIT,
  WINDOW_MS,
  "messages"
);

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

