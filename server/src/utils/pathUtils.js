// File: server/src/utils/pathUtils.js

// --- REPLACE START: single source of truth for file path normalization ---
/**
 * Path utilities for consistent, safe, and predictable web paths.
 * 
 * Goals:
 *  - Convert any local file path (including Windows backslashes) to a POSIX-style path.
 *  - Strip any protocol/host (in case a full URL was stored) and force the `/uploads/...` prefix.
 *  - Avoid duplicate slashes and keep the result stable for caching and comparisons.
 * 
 * Usage:
 *  - Use `toWebPath(p)` whenever you store or return file paths from the API.
 *  - Use `normalizeUploadsList(arr)` for arrays of image paths.
 * 
 * Notes:
 *  - We do NOT attempt to guess domains or CDN hosts here; the API should return
 *    relative web paths that the frontend can resolve (or prefix with CDN at render time).
 */

/** Convert backslashes to forward slashes. */
export function toPosix(p) {
  return typeof p === "string" ? p.replace(/\\/g, "/") : p;
}

/** Ensure a leading slash for local paths (no-op for absolute URLs). */
export function ensureLeadingSlash(p) {
  if (typeof p !== "string" || !p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Return true if the path points into the uploads space (with or without a leading slash).
 * @param {string} p
 */
export function isUploadsPath(p) {
  if (typeof p !== "string") return false;
  const s = toPosix(p).replace(/^https?:\/\/[^/]+/i, "");
  return /^\/?uploads\//i.test(s);
}

/**
 * Normalize any input path to a canonical web path under `/uploads/...`.
 *  - Keeps only the path part (drops protocol + host if present).
 *  - Forces POSIX slashes.
 *  - Ensures the `/uploads/` prefix exactly once.
 *  - Deduplicates adjacent slashes.
 *
 * @param {string} p - file path or URL
 * @returns {string|*} normalized web path or original value if falsy/non-string
 */
export function toWebPath(p) {
  if (!p || typeof p !== "string") return p;

  // 1) POSIX slashes
  const norm = toPosix(p);

  // 2) Remove protocol + host if present
  const withoutHost = norm.replace(/^https?:\/\/[^/]+/i, "");

  // 3) Strip leading /uploads (keep only the tail)
  const cleanTail = withoutHost.replace(/^\/?uploads\/?/i, "");

  // 4) Rebuild canonical path and collapse duplicate slashes
  return (`/uploads/${cleanTail}`).replace(/\/{2,}/g, "/");
}

/**
 * Normalize an array of paths into canonical `/uploads/...` paths.
 * - Filters out falsy values
 * - Deduplicates while preserving order
 * 
 * @param {Array<string>} list
 * @returns {Array<string>}
 */
export function normalizeUploadsList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw) continue;
    const w = toWebPath(raw);
    if (!w || w === "/uploads/") continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/**
 * Normalize selected fields on a plain object to `/uploads/...` paths.
 * - Mutates the input object (by design, for convenience in controllers).
 * - Supports both scalar string paths and arrays of paths.
 * 
 * @param {Record<string, any>} obj
 * @param {Array<string>} fields - e.g. ["profilePicture","photos","extraImages"]
 * @returns {Record<string, any>} the same object reference, for chaining
 */
export function mapToWebPaths(obj, fields = []) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of fields) {
    const val = obj[key];
    if (!val) continue;

    if (Array.isArray(val)) {
      obj[key] = normalizeUploadsList(val);
    } else if (typeof val === "string") {
      obj[key] = toWebPath(val);
    }
  }
  return obj;
}

// Default export remains the most commonly used helper.
export default toWebPath;
// --- REPLACE END ---
