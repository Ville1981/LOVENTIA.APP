// server/src/utils/securityHeaders.js

/**
 * Middleware to set security-related HTTP headers:
 * - Content Security Policy (CSP) – enforce header is controlled via env toggle
 * - Strict-Transport-Security (HSTS) – only in production over HTTPS
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * NOTE:
 * - CSP Report-Only is handled in app.js (Content-Security-Policy-Report-Only).
 * - This middleware is for the enforcing CSP header and a few strict defaults.
 */

// --- REPLACE START: switch to ESM default export ---
export default function securityHeaders(req, res, next) {
// --- REPLACE END ---
  // --- REPLACE START: Content Security Policy ---
  /**
   * IMPORTANT:
   * - CSP Report-Only header is handled by a dedicated middleware elsewhere.
   * - This utility is responsible ONLY for the enforcing CSP header.
   * - Enforce behavior is controlled by environment variables so we can:
   *   - keep dev/test relaxed (no enforce), and
   *   - turn on enforce in selected environments when ready.
   */

  // Base CSP policy string. Can be overridden via CSP_ENFORCE_POLICY if needed.
  const defaultCspPolicy =
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' wss:; " +
    "frame-ancestors 'none';";

  const cspPolicy = process.env.CSP_ENFORCE_POLICY || defaultCspPolicy;

  // Toggle for enforce header: CSP_ENFORCE=true/1 → set Content-Security-Policy
  const cspEnforceEnabled =
    process.env.CSP_ENFORCE === "true" || process.env.CSP_ENFORCE === "1";

  if (cspEnforceEnabled && cspPolicy) {
    res.setHeader("Content-Security-Policy", cspPolicy);
  }
  // If CSP_ENFORCE is not enabled, we do NOT set the enforce header here.
  // CSP Report-Only header will still be handled by its own middleware.
  // --- REPLACE END ---

  // --- REPLACE START: HTTP Strict Transport Security ---
  /**
   * HSTS:
   * - Only send in production, and only when the request is already using HTTPS.
   * - This avoids issues in local development and when running behind misconfigured proxies.
   */
  const isProd = process.env.NODE_ENV === "production";
  const forwardedProto = (req.headers["x-forwarded-proto"] || "")
    .toString()
    .toLowerCase();
  const isSecure =
    req.secure || forwardedProto.startsWith("https");

  if (isProd && isSecure) {
    // Enforce HTTPS for one year including subdomains
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  // --- REPLACE END ---

  // --- REPLACE START: Prevent MIME-type sniffing ---
  res.setHeader("X-Content-Type-Options", "nosniff");
  // --- REPLACE END ---

  // --- REPLACE START: Clickjacking protection ---
  res.setHeader("X-Frame-Options", "DENY");
  // --- REPLACE END ---

  // --- REPLACE START: Referrer policy ---
  res.setHeader("Referrer-Policy", "no-referrer");
  // --- REPLACE END ---

  // --- REPLACE START: Permissions policy (formerly Feature-Policy) ---
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), fullscreen=(self)"
  );
  // --- REPLACE END ---

  next();
}

