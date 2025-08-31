// File: client/src/utils/paths.js

// --- REPLACE START: tiny helper to normalize browser paths ---
// Converts any Windows-style backslashes to web-friendly forward slashes.
// Leaves non-strings (null, undefined, File objects, etc.) untouched.
export const toWebPath = (p) => (typeof p === 'string' ? p.replace(/\\/g, '/') : p);
// --- REPLACE END ---
