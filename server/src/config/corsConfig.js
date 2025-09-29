// PATH: server/src/config/corsConfig.js

// --- REPLACE START: centralized CORS config (ESM-compatible, fixes X-Requested-With preflight) ---
"use strict";

import cors from "cors";

/**
 * Normalize a URL string (remove trailing slash).
 */
function normalizeUrl(u) {
  if (typeof u !== "string") return u;
  return u.replace(/\/+$/, "");
}

/**
 * Build whitelist from env + common localhost variants.
 * You can extend this list for staging/production as needed.
 */
const envClient = normalizeUrl(process.env.CLIENT_URL || "http://localhost:5174");
const whitelist = Array.from(
  new Set(
    [
      envClient,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://loventia.app",
      "https://www.loventia.app",
    ].filter(Boolean)
  )
);

/**
 * Optional: allow all localhost origins regardless of port during development.
 * Implemented as a normal function to avoid TS parser quirks with inline && arrow.
 */
function allowAllLocalhost(origin) {
  if (process.env.NODE_ENV === "production") return false;
  const o = origin || "";
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);
}

/**
 * Centralized CORS options.
 * - Allows whitelisted origins (and server-to-server requests with no Origin)
 * - Sends proper preflight (OPTIONS) responses
 * - Enables credentials for cookie-based auth (required when using withCredentials)
 * - ✅ Allows `X-Requested-With` header to avoid preflight denials from axios/fetch helpers
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    const normalized = normalizeUrl(origin);

    if (whitelist.includes(normalized) || allowAllLocalhost(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  /**
   * Important: Access-Control-Allow-Headers must include every header the client
   * will send on CORS requests. We include a safe superset here.
   */
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With", // axios / legacy fetch helpers
    "x-requested-with", // some environments lowercase the header name
    "X-CSRF-Token",
    "Accept",
    "Accept-Language",
    "Origin",
    "Referer",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["Authorization"],
  credentials: true, // <-- required for cookie-based auth across origins
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 600, // cache preflight for 10 minutes
};

// Export configured middleware (ESM default export)
const corsConfig = cors(corsOptions);
export default corsConfig;
// --- REPLACE END ---
