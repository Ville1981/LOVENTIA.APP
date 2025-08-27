// --- REPLACE START: minimal recursive XSS sanitizer middleware (CommonJS) ---
/**
 * Very light XSS sanitizer that recursively walks req.body, req.query, req.params
 * and strips common script injection patterns. Intentionally conservative to
 * avoid breaking legitimate data; extend as needed.
 */

function sanitizeString(value) {
  if (typeof value !== 'string') return value;

  // Remove <script>...</script> blocks
  let v = value.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');

  // Remove on* event handlers within HTML-ish strings (e.g., onclick=)
  v = v.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

  // Neutralize javascript: and data: URIs
  v = v.replace(/\bjavascript\s*:/gi, '');
  v = v.replace(/\bdata\s*:/gi, '');

  // Angle brackets are common attack vector; strip them (safe, but conservative)
  v = v.replace(/[<>]/g, '');

  return v;
}

function sanitizeValue(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (typeof val === 'object') return sanitizeObject(val);
  return sanitizeString(val);
}

function sanitizeObject(obj) {
  const out = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeValue(obj[key]);
  }
  return out;
}

module.exports = function xssSanitizer(req, _res, next) {
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
    // Do not fail the request on sanitizer errors; just log and continue
    // eslint-disable-next-line no-console
    console.warn('xssSanitizer warning:', err && err.message ? err.message : err);
  }
  next();
};
// --- REPLACE END ---
