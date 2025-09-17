// File: server/src/middleware/httpsRedirect.js

// --- REPLACE START: enforce HTTPS in production, noop in test/dev (ESM) ---
/**
 * HTTPS redirect middleware.
 *
 * Behavior:
 * - If NODE_ENV === 'production': enforce HTTPS (also supports proxies via X-Forwarded-Proto).
 * - If NODE_ENV !== 'production' (dev/test): no-op, just call next().
 *
 * Notes:
 * - Trust proxy should be enabled at app level: app.set('trust proxy', 1)
 * - Skips redirect for health checks by default (/_health, /healthz), tweak as needed.
 *
 * ESM Export:
 * - Default export for ESM:   import httpsRedirect from "./httpsRedirect.js"
 */

import { format as urlFormat } from "url";

const isProd = process.env.NODE_ENV === "production";

// Allow-list of paths that should never be redirected (health checks etc.)
const SKIP_PATHS = new Set(["/healthz", "/_health", "/health", "/status"]);

export default function httpsRedirect(req, res, next) {
  try {
    if (!isProd) {
      // In dev/test we don’t force HTTPS to keep local tooling simple
      return next();
    }

    // If path is explicitly skipped (health checks, etc.), allow without redirect
    if (SKIP_PATHS.has(req.path)) {
      return next();
    }

    // Check if request is already secure (req.secure requires app.set('trust proxy', 1))
    const forwardedProto = (req.headers["x-forwarded-proto"] || "")
      .toString()
      .toLowerCase();
    const alreadyHttps = req.secure || forwardedProto === "https";

    if (alreadyHttps) {
      return next();
    }

    // Build the HTTPS URL preserving host and original URL
    const host = req.headers.host;
    // If host is missing, safest is to proceed without redirect to avoid loops
    if (!host) return next();

    const redirectUrl = urlFormat({
      protocol: "https",
      host,
      pathname: req.originalUrl || req.url || "/",
    });

    // Use 301 in production; if you worry about caches while rolling out, switch to 302 first
    return res.redirect(301, redirectUrl);
  } catch (_err) {
    // On any unexpected error, fail open instead of blocking requests
    return next();
  }
}
// --- REPLACE END ---
