// PATH: server/src/middleware/security.js

// --- REPLACE START
/**
 * Security middleware stack (ESM)
 *
 * Ordering inside this router:
 *  1) Helmet         - secure HTTP headers (CSP relaxed in non-prod for Swagger/UI/devtools)
 *  2) CORS           - single, centralized config (do NOT duplicate elsewhere)
 *  3) XSS guard      - very light, defensive sanitizer for common payload shapes
 *  4) Compression    - gzip/deflate with sensible defaults (skip already-compressed types)
 *
 * Mounting order in app.js:
 *   - (Stripe raw webhook FIRST, before json())
 *   - app.use(security)  <- mount THIS early
 *   - app.use(express.json(...)) etc.
 *   - app.use('/api', apiRouter)
 */

"use strict";

import express from "express";
import helmet from "helmet";
import compression from "compression";
// Important: keep CORS centralized to avoid duplicate/competing headers.
import corsConfig from "../config/cors.js";

const router = express.Router();
const isProd = process.env.NODE_ENV === "production";

/* -------------------------------------------------------------------------- */
/* 1) HELMET                                                                  */
/* -------------------------------------------------------------------------- */
/**
 * Notes:
 * - CSP is disabled in non-production so Swagger UI, Redoc, Vite dev, etc. work without extra config.
 * - In production, we enable HSTS and a conservative CSP baseline you can extend later.
 * - helmet includes noSniff, hidePoweredBy, frameguard, dnsPrefetchControl, ieNoOpen, etc.
 */
router.use(
  helmet({
    // Keep CSP permissive in dev/test to avoid blocking tooling.
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", "data:", "blob:"],
            "media-src": ["'self'", "data:", "blob:"],
            "font-src": ["'self'", "data:"],
            "style-src": ["'self'", "'unsafe-inline'"], // allow inline styles from UI libs
            "script-src": ["'self'", "'unsafe-eval'"],  // relax eval if needed for some UI bundles
            "connect-src": ["'self'"],
            "frame-ancestors": ["'self'"],
          },
        }
      : false,

    // Only send HSTS in production (avoid locking down local dev hosts).
    hsts: isProd
      ? {
          maxAge: 15552000, // 180 days
          includeSubDomains: true,
          preload: false,
        }
      : false,

    // Helps with cross-origin fetches for images/assets we legitimately serve.
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // COEP disabled to keep dev tools like Swagger working without extra headers.
    crossOriginEmbedderPolicy: false,

    // Reasonable default; reveals origin on same-origin, strips on cross-origin.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // Frameguard stays on to prevent clickjacking; sameorigin is typically safe.
    frameguard: { action: "sameorigin" },
  })
);

/* -------------------------------------------------------------------------- */
/* 2) CORS (single source of truth)                                           */
/* -------------------------------------------------------------------------- */
/**
 * Do NOT add ad-hoc CORS headers anywhere else. All CORS is handled here via corsConfig.
 * corsConfig must export a ready-to-use middleware (e.g., from `cors` package with allowlist).
 */
router.use(corsConfig);

/* -------------------------------------------------------------------------- */
/* 3) Very light XSS guard (defensive)                                        */
/* -------------------------------------------------------------------------- */
/**
 * This is a minimal best-effort sanitizer that strips obvious <script> tags
 * from typical request containers (body, query, params). It is intentionally
 * conservative and non-destructive. For richer needs, swap to a vetted lib
 * (e.g., DOMPurify server-side) at your controllers/validators.
 */
function stripScripts(value) {
  if (typeof value === "string") {
    // Remove opening/closing <script ...> tags (case-insensitive), keep contents.
    return value.replace(/<\s*\/?\s*script\b[^>]*>/gi, "");
  }
  return value;
}

function deepSanitize(obj, depth = 0) {
  if (!obj || depth > 3) return obj; // avoid deep recursion
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) obj[i] = deepSanitize(obj[i], depth + 1);
    return obj;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) obj[k] = deepSanitize(obj[k], depth + 1);
    return obj;
  }
  return stripScripts(obj);
}

router.use((req, _res, next) => {
  try {
    if (req.body) req.body = deepSanitize(req.body);
    if (req.query) req.query = deepSanitize(req.query);
    if (req.params) req.params = deepSanitize(req.params);
  } catch {
    // fail-quietly: this guard is best-effort and must not block requests
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* 4) Compression                                                             */
/* -------------------------------------------------------------------------- */
/**
 * Apply gzip/deflate. We avoid compressing already-compressed or tiny payloads.
 * If you serve large file downloads, consider skipping compression for them.
 */
router.use(
  compression({
    threshold: 1024, // only compress responses > 1KB
    // Skip common already-compressed types (images, archives, etc.)
    filter: (req, res) => {
      const type = res.getHeader("Content-Type");
      if (type && typeof type === "string") {
        if (
          /\b(?:image|audio|video)\b/i.test(type) ||
          /\b(?:zip|gzip|application\/pdf|application\/wasm)\b/i.test(type)
        ) {
          return false;
        }
      }
      // Respect standard "Cache-Control: no-transform" if present
      const cacheControl = res.getHeader("Cache-Control");
      if (cacheControl && /\bno-transform\b/i.test(String(cacheControl))) return false;
      return compression.filter(req, res);
    },
  })
);

/* -------------------------------------------------------------------------- */
/* Placeholder: keep additional security middleware here (original order)      */
/* -------------------------------------------------------------------------- */
// Example placeholders (enable if you already use them elsewhere):
// import rateLimit from "express-rate-limit";
// const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
// router.use(apiLimiter);

// import mongoSanitize from "express-mongo-sanitize";
// router.use(mongoSanitize());

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */
export default router;
// --- REPLACE END








