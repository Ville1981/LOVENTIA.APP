// PATH: server/src/config/corsConfig.js

<<<<<<< HEAD
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

// --- REPLACE START: stricter CORS defaults with env-based allowlist ---
import cors from 'cors';

const RAW_ORIGINS =
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_URL ||
  '';

const allowList = RAW_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export default function corsConfig(req, callback) {
  const origin = req.header('Origin');
  let corsOptions;

  if (!origin || allowList.length === 0) {
    // No Origin header (e.g., curl, server-to-server) -> allow basic
    corsOptions = { origin: false, credentials: true };
  } else if (allowList.includes(origin)) {
    corsOptions = { origin: true, credentials: true };
  } else {
    corsOptions = { origin: false, credentials: true };
  }

  return cors(corsOptions)(req, callback);
}
// --- REPLACE END ---

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
=======
// --- REPLACE START: centralized CORS config (ESM-compatible, no duplicate imports, env-driven allowlist) ---
import cors from "cors";

/**
 * Normalize URL to a stable "protocol//host[:port]" string without trailing slash.
 * Falls back to trimmed raw value if URL constructor fails.
 */
function normalizeUrl(value) {
  if (!value) return "";
  const v = String(value).trim();
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    return v.replace(/\/+$/, "");
  }
}

/**
 * Build allowlist from:
 *  - Static dev defaults (Vite 5173 & 5174 on localhost/127.0.0.1)
 *  - CLIENT_ORIGIN / CLIENT_URL (legacy support)
 *  - CORS_ORIGINS (comma separated)
 * In non-production we also allow any localhost/127.x origin by regex fallback.
 */
const STATIC_LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const ENV_SINGLE = normalizeUrl(
  process.env.CLIENT_ORIGIN ||
    process.env.CLIENT_URL ||
    ""
);

const ENV_LIST = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => normalizeUrl(s))
  .filter(Boolean);

const ALLOWLIST = Array.from(
  new Set(
    []
      .concat(STATIC_LOCAL_ORIGINS)
      .concat(ENV_SINGLE ? [ENV_SINGLE] : [])
      .concat(ENV_LIST)
  )
).filter(Boolean);

// Allow a wider localhost range during development to reduce friction.
const DEV_LOCALHOST_REGEX = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i;

/**
 * Centralized CORS options.
 * - Mirrors whitelisted Origin (never returns "*")
 * - Supports credentials (cookies)
 * - Permissive preflight with common headers used by axios/fetch
 * - 204 for OPTIONS
 */
export const corsOptions = {
  origin(origin, cb) {
    // Allow requests with no Origin header (server-to-server, curl, health checks)
    if (!origin) return cb(null, true);

    const normalized = normalizeUrl(origin);
    const isExplicit = ALLOWLIST.includes(normalized);
    const isDevLocalhost =
      process.env.NODE_ENV !== "production" && DEV_LOCALHOST_REGEX.test(origin);

    if (isExplicit || isDevLocalhost) return cb(null, true);

    // Helpful server-side log (not sent to client)
    // eslint-disable-next-line no-console
    console.warn(`[CORS] Blocked Origin: ${origin}`);
    return cb(new Error(`CORS: origin not allowed (${origin})`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With", // axios/fetch helpers sometimes send this
    "x-requested-with",
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
    "Accept",
    "Accept-Language",
    "Origin",
    "Referer",
    "Cache-Control",
    "Pragma",
  ],
<<<<<<< HEAD
  exposedHeaders: ["Authorization"],
  credentials: true, // <-- required for cookie-based auth across origins
=======
  exposedHeaders: ["Set-Cookie", "Authorization"],
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 600, // cache preflight for 10 minutes
};

<<<<<<< HEAD
// Export configured middleware (ESM default export)
=======
/**
 * Export configured middleware so app.js / loaders can `app.use(corsConfig)`
 */
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
const corsConfig = cors(corsOptions);
export default corsConfig;
// --- REPLACE END ---
