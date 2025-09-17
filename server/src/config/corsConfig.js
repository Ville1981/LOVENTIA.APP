// --- REPLACE START: centralized CORS config (ESM-compatible, fixes X-Requested-With preflight) ---
"use strict";

import cors from "cors";

// Allowed origins — extend this array for staging/production
const whitelist = [
  process.env.CLIENT_URL || "http://localhost:5174",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "https://loventia.app",
  "https://www.loventia.app",
];

/**
 * Centralized CORS options.
 * - Allows whitelisted origins (and server-to-server requests with no Origin)
 * - Sends proper preflight (OPTIONS) responses
 * - Enables credentials for cookie-based auth
 * - ✅ Allows `X-Requested-With` (both cases) to fix your current preflight failure
 */
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin || whitelist.includes(origin)) {
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
    "X-Requested-With",   // axios / legacy fetch helpers
    "x-requested-with",   // some environments lowercase the header name
    "X-CSRF-Token",
    "Accept",
    "Accept-Language",
    "Origin",
    "Referer",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false,
  maxAge: 600, // cache preflight for 10 minutes
};

// Export configured middleware (ESM default export)
const corsConfig = cors(corsOptions);
export default corsConfig;
// --- REPLACE END ---
