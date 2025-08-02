// utils/securityHeaders.js

/**
 * Middleware to set security-related HTTP headers:
 * - Content Security Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 */

module.exports = function securityHeaders(req, res, next) {
  // --- REPLACE START: Content Security Policy ---
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' wss:; " +
      "frame-ancestors 'none';"
  );
  // --- REPLACE END ---

  // --- REPLACE START: HTTP Strict Transport Security ---
  // Enforce HTTPS for one year including subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // --- REPLACE END ---

  // --- REPLACE START: Prevent MIME-type sniffing ---
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // --- REPLACE END ---

  // --- REPLACE START: Clickjacking protection ---
  res.setHeader('X-Frame-Options', 'DENY');
  // --- REPLACE END ---

  // --- REPLACE START: Referrer policy ---
  res.setHeader('Referrer-Policy', 'no-referrer');
  // --- REPLACE END ---

  // --- REPLACE START: Permissions policy (formerly Feature-Policy) ---
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), fullscreen=(self)'
  );
  // --- REPLACE END ---

  next();
};
