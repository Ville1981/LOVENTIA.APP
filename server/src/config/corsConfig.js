// PATH: server/src/config/corsConfig.js

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
    "Accept",
    "Accept-Language",
    "Origin",
    "Referer",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["Set-Cookie", "Authorization"],
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 600, // cache preflight for 10 minutes
};

/**
 * Export configured middleware so app.js / loaders can `app.use(corsConfig)`
 */
const corsConfig = cors(corsOptions);
export default corsConfig;
// --- REPLACE END ---
