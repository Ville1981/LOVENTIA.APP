// PATH: server/src/middleware/security.js

// --- REPLACE START: delegate CORS to centralized corsConfig and keep security middleware early ---
"use strict";

import express from "express";
import helmet from "helmet";
// Important: CORS must be centralized to avoid duplicate/competing headers.
import corsConfig from "../config/corsConfig.js";

const router = express.Router();

/**
 * Security middleware stack
 *
 * Ordering matters:
 * 1) Helmet — sets safe HTTP headers.
 * 2) CORS — single, centralized config (corsConfig.js). Do NOT add another `cors(...)` here.
 * 3) (Optional) Additional security middlewares (rate limiter, sanitizers, etc.) in your original order.
 *
 * NOTE:
 * - Do not set any manual `Access-Control-Allow-*` headers in routes. Let corsConfig handle all CORS.
 * - Ensure app.js/server.js mounts this router BEFORE any routes (e.g., `app.use(securityMiddleware)` first).
 */

// Helmet (disable strict CSP outside production to keep dev tools like Swagger/UI working)
router.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// Single source of truth for CORS (origin allowlist & headers come from corsConfig.js)
router.use(corsConfig);

/* ------------------------------------------------------------------------- */
/* Optional: keep your additional security middleware here (original order). */
/* ------------------------------------------------------------------------- */
// Example placeholders (commented out intentionally; restore if you use them):
// import rateLimit from "express-rate-limit";
// const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
// router.use(apiLimiter);

// import xssSanitizer from "../middleware/xssSanitizer.js";
// import sqlSanitizer from "../middleware/sqlSanitizer.js";
// router.use(xssSanitizer);
// router.use(sqlSanitizer);

/**
 * Export as middleware/router so app.js can `app.use(securityMiddleware)` BEFORE any routes.
 * This ensures corsConfig applies to all requests and no other ad-hoc CORS overrides leak in.
 */
export default router;
// --- REPLACE END ---














