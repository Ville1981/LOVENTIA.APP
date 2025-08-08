// --- REPLACE START: Middleware to sanitize incoming request body from XSS ---
// Prevents cross-site scripting attacks by sanitizing all string inputs in req.body.

const xss = require('xss');

/**
 * Recursively sanitize a value:
 * - If string → sanitize with xss()
 * - If array → sanitize each element
 * - If object → sanitize each property
 * - Otherwise return value as-is
 */
function sanitizeObject(value) {
  if (typeof value === 'string') {
    return xss(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeObject);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitized[key] = sanitizeObject(value[key]);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Express middleware to sanitize req.body
 */
function xssSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = xssSanitizer;
// --- REPLACE END ---
