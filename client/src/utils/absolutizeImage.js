// PATH: client/src/utils/absolutizeImage.js

// --- REPLACE START: add normalizeUserImages helper (build photos list + profilePicture from photos/extraImages/profilePicture; absolutize against BACKEND_BASE_URL) ---
import { BACKEND_BASE_URL } from "../config";

/**
 * Returns true if the string already looks like an absolute http(s) URL.
 */
export function isAbsoluteUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s.trim());
}

/**
 * Normalize any path-like string to a clean server-relative path.
 * - Converts Windows backslashes -> forward slashes
 * - Trims spaces
 * - Ensures a single leading '/uploads/' for bare filenames or raw 'uploads/...'
 * - Avoids duplicate '/uploads/uploads'
 * - Preserves already rooted non-uploads paths like '/assets/foo.jpg'
 */
export function normalizeServerPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (s === "") return null;

  // Already absolute? leave as-is
  if (isAbsoluteUrl(s)) return s;

  // Normalize slashes
  s = s.replace(/\\/g, "/");

  // If already rooted and not an uploads file, keep as-is
  if (s.startsWith("/assets/") || s.startsWith("/static/")) {
    return s;
  }

  // Strip any accidental double-prefixes like '/uploads/uploads/...'
  s = s.replace(/^\/+/, ""); // remove leading slashes for a moment
  s = s.replace(/^uploads\/uploads\//, "uploads/");

  // If path starts with 'uploads/', keep it; otherwise treat as bare filename
  if (!s.startsWith("uploads/")) {
    // bare filename or nested path -> store under uploads/
    s = `uploads/${s}`;
  }

  // Re-root
  return `/${s}`;
}

/**
 * Absolutize an image reference (string or {url}) against BACKEND_BASE_URL.
 * Accepts:
 *  - Absolute http(s) URL -> returned unchanged
 *  - '/uploads/xyz.jpg'   -> BACKEND_BASE_URL + '/uploads/xyz.jpg'
 *  - 'uploads\\xyz.jpg'   -> normalized and absolutized
 *  - 'xyz.jpg'            -> '/uploads/xyz.jpg' -> absolutized
 *
 * Returns a string URL or null if input is empty/invalid.
 */
export function absolutizeImage(pathOrObj) {
  if (!pathOrObj) return null;

  // Support both string and { url } objects
  const raw =
    typeof pathOrObj === "string"
      ? pathOrObj
      : typeof pathOrObj === "object" && pathOrObj.url
      ? pathOrObj.url
      : null;

  if (!raw) return null;

  // Absolute URL? return unchanged
  if (isAbsoluteUrl(raw)) return raw;

  // Normalize to server-relative
  const serverRel = normalizeServerPath(raw);
  if (!serverRel) return null;

  // Join with BACKEND_BASE_URL and avoid accidental double slashes
  const base = String(BACKEND_BASE_URL || "").replace(/\/+$/, ""); // trim trailing '/'
  return `${base}${serverRel}`.replace(/([^:])\/\/+/g, "$1/"); // keep protocol 'http://'
}

/**
 * Normalize a user object’s image fields.
 * - Builds photos array from:
 *     1) u.photos
 *     2) u.extraImages
 *     3) u.profilePicture (fallback)
 * - Absolutizes URLs using absolutizeImage.
 * - profilePicture is derived from u.profilePicture or first photo.
 * - Returns a shallow-cloned object; does not mutate the input.
 *
 * Note:
 * - photos/extraImages are returned as [{ url: absolute }] so callers can
 *   safely use either shape.
 */
export function normalizeUserImages(u) {
  if (!u || typeof u !== "object") return u;

  // Build photos array from photos -> extraImages -> profilePicture
  let photos = [];
  if (Array.isArray(u.photos) && u.photos.length) {
    photos = u.photos
      .map((p) => {
        const abs = absolutizeImage(p);
        return abs ? { url: abs } : null;
      })
      .filter(Boolean);
  } else if (Array.isArray(u.extraImages) && u.extraImages.length) {
    photos = u.extraImages
      .map((p) => {
        const abs = absolutizeImage(p);
        return abs ? { url: abs } : null;
      })
      .filter(Boolean);
  } else if (u.profilePicture) {
    const abs = absolutizeImage(u.profilePicture);
    if (abs) photos.push({ url: abs });
  }

  const profilePicture =
    absolutizeImage(u.profilePicture) || (photos[0] && photos[0].url) || null;

  return {
    ...u,
    photos,
    extraImages: photos, // keep alias in sync for legacy callers
    profilePicture,
  };
}
// --- REPLACE END ---

