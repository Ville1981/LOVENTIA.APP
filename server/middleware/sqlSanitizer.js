// --- REPLACE START: Middleware to escape SQL special characters ---
// Uses 'sqlstring' to escape strings and prevent SQL injection in raw queries.

const SqlString = require('sqlstring');

/**
 * Recursively escape SQL strings:
 * - If string → escape with SqlString.escape()
 * - If array → escape each element
 * - If object → escape each property
 * - Otherwise return value as-is
 */
function escapeObject(value) {
  if (typeof value === 'string') {
    // Remove surrounding quotes from SqlString.escape output
    return SqlString.escape(value).slice(1, -1);
  }

  if (Array.isArray(value)) {
    return value.map(escapeObject);
  }

  if (value !== null && typeof value === 'object') {
    const escaped = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        escaped[key] = escapeObject(value[key]);
      }
    }
    return escaped;
  }

  return value;
}

/**
 * Express middleware to escape all strings in req.body
 */
function sqlSanitizer(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = escapeObject(req.body);
  }
  next();
}

module.exports = sqlSanitizer;
// --- REPLACE END ---
