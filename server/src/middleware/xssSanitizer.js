// File: server/src/middleware/xssSanitizer.js

// --- REPLACE START: minimal recursive XSS sanitizer middleware (ESM with CJS interop) ---
/**
 * Very light XSS sanitizer that recursively walks req.body, req.query, req.params
 * and strips common script injection patterns. Intentionally conservative to
 * avoid breaking legitimate data; extend as needed.
 *
 * Exports:
 *  - default export (ESM):   import xssSanitizer from "./xssSanitizer.js"
 *  - CJS interop (optional): const xssSanitizer = require("./xssSanitizer.js")
 */

function sanitizeString(value) {
  if (typeof value !== "string") return value;

  // Remove <script>...</script> blocks
  let v = value.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "");

  // Remove on* event handlers within HTML-ish strings (e.g., onclick=)
  v = v.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");

  // Neutralize javascript: and data: URIs
  v = v.replace(/\bjavascript\s*:/gi, "");
  v = v.replace(/\bdata\s*:/gi, "");

  // Angle brackets are common attack vector; strip them (safe, but conservative)
  v = v.replace(/[<>]/g, "");

  return v;
}

function sanitizeValue(val) {
  if (val == null) return val;
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (typeof val === "object") return sanitizeObject(val);
  return sanitizeString(val);
}

function sanitizeObject(obj) {
  const out = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeValue(obj[key]);
  }
  return out;
}

export default function xssSanitizer(req, _res, next) {
  try {
    if (req && req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
    if (req && req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }
    if (req && req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }
  } catch (err) {
    // Do not fail the request on sanitizer errors; just log and continue
    // eslint-disable-next-line no-console
    console.warn(
      "xssSanitizer warning:",
      err && err.message ? err.message : err
    );
  }
  return typeof next === "function" ? next() : undefined;
}

// --- REPLACE START: safe (optional) CJS interop ---
// Keep file ESM-first. Add CJS export only if someone requires this file directly.
try {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = function (req, res, next) {
      return xssSanitizer(req, res, next);
    };
  }
} catch {
  // no-op in pure ESM environments
}
// --- REPLACE END ---
// --- REPLACE END ---
