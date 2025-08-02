// server/src/middleware/xssSanitizer.js

/**
 * Middleware to sanitize all string inputs in req.body to prevent XSS attacks.
 * Uses the 'xss' package to clean any HTML or script tags.
 */

const xss = require('xss');

/**
 * Recursively sanitize a value.
 * - If string, run through xss filter.
 * - If array, sanitize each element.
 * - If object, sanitize each property.
 * - Otherwise, return as-is.
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

  // For numbers, booleans, null, undefined, etc.
  return value;
}

/**
 * Express middleware to sanitize req.body.
 */
function xssSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

module.exports = xssSanitizer;
