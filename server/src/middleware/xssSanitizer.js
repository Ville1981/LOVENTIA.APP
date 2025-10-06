// File: server/src/middleware/xssSanitizer.js

// --- REPLACE START: minimal recursive XSS sanitizer middleware (ESM with CJS interop) ---
/**
 * Very light XSS sanitizer that recursively walks req.body, req.query, req.params
 * and strips common script injection patterns. Intentionally conservative to
 * avoid breaking legitimate data; extend as needed.
 *
 * IMPORTANT: We sanitize IN PLACE to avoid assigning to req.query/req.body/req.params,
 * which can throw "has only a getter" errors in some Express setups.
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

  // Angle brackets are common attack vector; strip them (conservative)
  v = v.replace(/[<>]/g, "");

  return v;
}

function sanitizeValue(val) {
  if (val == null) return val;
  if (Array.isArray(val)) {
    // sanitize array in place
    for (let i = 0; i < val.length; i++) {
      const item = val[i];
      if (item && typeof item === "object") {
        walkAndSanitize(item);
      } else {
        val[i] = sanitizeString(item);
      }
    }
    return val;
  }
  if (typeof val === "object") {
    walkAndSanitize(val);
    return val;
  }
  return sanitizeString(val);
}

function walkAndSanitize(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const current = obj[key];
    if (current && typeof current === "object") {
      sanitizeValue(current); // recurse / in-place
    } else {
      obj[key] = sanitizeString(current);
    }
  }
}

export default function xssSanitizer(req, _res, next) {
  try {
    // Sanitize in place; DO NOT reassign req.query/body/params
    if (req?.query && typeof req.query === "object") {
      walkAndSanitize(req.query);
    }
    if (req?.body && typeof req.body === "object") {
      walkAndSanitize(req.body);
    }
    if (req?.params && typeof req.params === "object") {
      walkAndSanitize(req.params);
    }

    // Optional: expose sanitized references (same objects, post-sanitization)
    req.sanitized = req.sanitized || {};
    req.sanitized.query = req.query;
    req.sanitized.body = req.body;
    req.sanitized.params = req.params;
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
