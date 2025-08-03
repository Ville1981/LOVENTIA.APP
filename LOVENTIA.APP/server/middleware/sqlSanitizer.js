// server/src/middleware/sqlSanitizer.js

/**
 * Middleware to escape all string inputs in req.body, req.query, and req.params
 * to reduce risk of SQL injection when using raw queries.
 * Relies on the 'sqlstring' package for escaping.
 *
 * Note: For maximum safety, prefer using parameterized queries or an ORM.
 */

const SqlString = require('sqlstring');

/**
 * Recursively sanitize a value:
 * - Strings are escaped via SqlString.escape (removes surrounding quotes afterward).
 * - Arrays and objects are processed element-by-element / property-by-property.
 * - Other types pass through unchanged.
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    // SqlString.escape wraps the string in quotes; strip them:
    const escaped = SqlString.escape(value);
    return escaped.length >= 2 && escaped[0] === "'" && escaped[escaped.length - 1] === "'"
      ? escaped.slice(1, -1)
      : escaped;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitizedObj = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        sanitizedObj[key] = sanitizeValue(value[key]);
      }
    }
    return sanitizedObj;
  }

  // For numbers, booleans, null, undefined, etc.
  return value;
}

/**
 * Express middleware: sanitize incoming inputs
 */
function sqlSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }
  next();
}

module.exports = sqlSanitizer;
