// File: server/src/middleware/sqlSanitizer.js

// --- REPLACE START: minimal recursive SQL injection sanitizer middleware (ESM, dual-mode) ---
/**
 * Light-touch SQL sanitizer. This does NOT replace parameterized queries or ORM
 * protections; it only reduces obvious payload noise (e.g., inline comments,
 * stacked statements). Keep conservative to avoid mangling valid inputs.
 *
 * Hardened for tests/bootstraps:
 * - Safely handles missing/undefined req or res.
 * - Calls `next` only if it is a function (avoids "next is not a function").
 * - Wraps property access in guards so we never throw on req.body/req.query/req.params.
 *
 * Export is **dual-mode** (keeps prior behavior while being ESM compatible):
 *   1) Factory style (recommended):
 *        import sqlSanitizer from "./middleware/sqlSanitizer.js";
 *        app.use(sqlSanitizer());                    // returns middleware function
 *
 *   2) Direct middleware (also supported):
 *        import sqlSanitizer from "./middleware/sqlSanitizer.js";
 *        app.use(sqlSanitizer);                      // works because export detects (req,res,next)
 */

const DANGEROUS_TOKENS = [
  /--/g,               // inline comment
  /\/\*[\s\S]*?\*\//g, // block comment
];

function stripDangerousTokens(str) {
  if (typeof str !== "string") return str;

  let v = str;

  // Remove SQL comments
  for (const rx of DANGEROUS_TOKENS) v = v.replace(rx, "");

  // Collapse statement separators ; to a single space (avoid stacked statements)
  v = v.replace(/;/g, " ");

  // Remove common tautology patterns (very conservative)
  v = v.replace(/\b(or|and)\b\s+1\s*=\s*1/gi, " ");
  v = v.replace(/\b(or|and)\b\s+'1'\s*=\s*'1'/gi, " ");

  // Neutralize exec/xp_ (rarely legitimate in user input)
  v = v.replace(/\bxp_\w+/gi, "");
  v = v.replace(/\bexec(\s+|\b)/gi, " ");

  return v;
}

function sanitizeValue(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (typeof val === "object") return sanitizeObject(val);
  return stripDangerousTokens(val);
}

function sanitizeObject(obj) {
  const out = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeValue(obj[key]);
  }
  return out;
}

/**
 * Internal implementation that performs sanitization on req. Safe to call
 * with partial/missing args; will only invoke `next` if it is a function.
 */
function runSanitizer(req, _res, next /* , opts */) {
  try {
    const hasReq = req && typeof req === "object";

    if (hasReq && req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
    if (hasReq && req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }
    if (hasReq && req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("sqlSanitizer warning:", err && err.message ? err.message : err);
  }

  if (typeof next === "function") return next();
  return; // no-op if next is absent or not a function
}

/**
 * Dual-mode export:
 *  - If called like a middleware (req,res,next), sanitize immediately.
 *  - Otherwise, treat as a factory and return a middleware function.
 * Any provided options (unused for now) are accepted for future extensibility.
 */
export default function sqlSanitizerDual(/* optsOrReq, res, next */) {
  // Detect direct middleware usage by checking if the last arg looks like `next`
  if (arguments.length >= 2 && typeof arguments[arguments.length - 1] === "function") {
    return runSanitizer(arguments[0], arguments[1], arguments[2]);
  }

  // Factory usage: return the real middleware
  // eslint-disable-next-line no-unused-vars
  const opts =
    arguments.length === 1 && arguments[0] && typeof arguments[0] === "object"
      ? arguments[0]
      : {};

  return function sqlSanitizerMiddleware(req, res, next) {
    return runSanitizer(req, res, next /* , opts */);
  };
}
// --- REPLACE END ---
