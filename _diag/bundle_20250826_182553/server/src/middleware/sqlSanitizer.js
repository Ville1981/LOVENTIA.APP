// --- REPLACE START: minimal recursive SQL injection sanitizer middleware (CommonJS) ---
/**
 * Light-touch SQL sanitizer. This does NOT replace parameterized queries or ORM
 * protections; it only reduces obvious payload noise (e.g., inline comments,
 * stacked statements). Keep conservative to avoid mangling valid inputs.
 */

const DANGEROUS_TOKENS = [
  /--/g,                 // inline comment
  /\/\*[\s\S]*?\*\//g,   // block comment
];

function stripDangerousTokens(str) {
  if (typeof str !== 'string') return str;

  let v = str;

  // Remove SQL comments
  for (const rx of DANGEROUS_TOKENS) v = v.replace(rx, '');

  // Collapse statement separators ; to a single space (avoid stacked statements)
  v = v.replace(/;/g, ' ');

  // Remove common tautology patterns (very conservative)
  v = v.replace(/\b(or|and)\b\s+1\s*=\s*1/gi, ' ');
  v = v.replace(/\b(or|and)\b\s+'1'\s*=\s*'1'/gi, ' ');

  // Neutralize exec/xp_ (rarely legitimate in user input)
  v = v.replace(/\bxp_\w+/gi, '');
  v = v.replace(/\bexec(\s+|\b)/gi, ' ');

  return v;
}

function sanitizeValue(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (typeof val === 'object') return sanitizeObject(val);
  return stripDangerousTokens(val);
}

function sanitizeObject(obj) {
  const out = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeValue(obj[key]);
  }
  return out;
}

module.exports = function sqlSanitizer(req, _res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('sqlSanitizer warning:', err && err.message ? err.message : err);
  }
  next();
};
// --- REPLACE END ---
