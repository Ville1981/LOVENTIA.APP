// PATH: server/src/utils/normalizeUserOut.js

// --- REPLACE START: unified user normalizer (NO field cutting; arrays guaranteed; POSIX /uploads paths; no duplicates) ---
/**
 * Unified user normalizer for API output.
 *
 * Required behavior:
 *  • Remove sensitive fields (passwords, reset/verify tokens, internal flags).
 *  • Guarantee arrays for `photos` and `extraImages` (NEVER `{}`, return [] if empty).
 *  • Normalize any file-like path to canonical POSIX `/uploads/...`:
 *      - no backslashes
 *      - no host/protocol
 *      - single leading `/uploads/`
 *      - collapse duplicate slashes
 *  • Mirror `photos` and `extraImages` to the same cleaned list for consistency.
 *  • Preserve all domain fields (no whitelisting). Only adjust the minimal set above.
 *  • Work with both Mongoose documents and plain objects.
 *
 * Implementation notes:
 *  • Keep comments & strings in English.
 *  • Expose a couple of helpers (toWebPath, normalizeUsersOut) for reuse in routes/controllers.
 */

/* ─────────────────────────────────────────────────────────────────────────────
 * Path helpers
 * ────────────────────────────────────────────────────────────────────────────*/

/** Convert Windows backslashes to forward slashes. */
function toPosix(p) {
  return typeof p === "string" ? p.replace(/\\/g, "/") : p;
}

/** Strip protocol/host from URL-like strings (keep only the path). */
function stripHost(p) {
  if (typeof p !== "string") return p;
  return p.replace(/^https?:\/\/[^/]+/i, "");
}

/**
 * Normalize any path-like string to a canonical `/uploads/...` form.
 * Steps:
 *  1) Convert backslashes to slashes
 *  2) Remove protocol/host if present
 *  3) Remove any leading "uploads/" or "/uploads/"
 *  4) Prefix with single `/uploads/`
 *  5) Collapse duplicate slashes
 */
export function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = toPosix(stripHost(p));
  s = s.replace(/^\/?uploads\/?/i, "");        // strip any existing uploads prefix
  s = `/uploads/${s}`.replace(/\/{2,}/g, "/"); // ensure single leading and collapse dups
  return s;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Collection helpers
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Coerce an unknown input into an array:
 *  - If it's already an array → return as-is
 *  - If it's a plain object → use Object.values(v) (handles `{0:'a',1:'b'}` coming from bad serialization)
 *  - Otherwise → []
 */
export function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

/** Clean and deduplicate a list of file paths. */
export function cleanPathList(list) {
  const out = [];
  const seen = new Set();
  for (const item of asArray(list)) {
    if (!item) continue;
    const norm = toWebPath(String(item));
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sensitive field handling
 * ────────────────────────────────────────────────────────────────────────────*/

/** Remove sensitive/internal fields from a user-like object (mutates the given clone). */
export function stripSensitive(u) {
  // Passwords / auth
  delete u.password;
  delete u.hash;
  delete u.salt;

  // Reset / verification tokens
  delete u.resetToken;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;
  delete u.verificationCode;
  delete u.emailVerificationCode;
  delete u.emailVerificationToken;
  delete u.twoFactorSecret;

  // Misc internal
  delete u.__v;

  return u;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Array-field guarantees
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Ensure array fields exist and are normalized.
 * Guarantees: photos = [], extraImages = [] when absent; both lists are canonicalized and mirrored.
 */
export function ensureArrayFields(u) {
  let photos = cleanPathList(u.photos);
  let extraImages = cleanPathList(u.extraImages);

  // If only one of them has data, mirror to the other for consistency
  if (photos.length === 0 && extraImages.length > 0) photos = [...extraImages];
  if (extraImages.length === 0 && photos.length > 0) extraImages = [...photos];

  u.photos = photos;
  u.extraImages = extraImages;
  return u;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Avatar/ID normalization
 * ────────────────────────────────────────────────────────────────────────────*/

/** Derive a canonical avatar path and keep aliases in sync. */
export function ensureCanonicalAvatar(u) {
  // Normalize existing fields first (if they exist)
  if (u.profilePicture) u.profilePicture = toWebPath(u.profilePicture);
  if (u.profilePhoto)   u.profilePhoto   = toWebPath(u.profilePhoto);
  if (u.avatar)         u.avatar         = toWebPath(u.avatar);

  // Pick a representative avatar if one isn't explicitly set
  const candidate = u.profilePicture || u.profilePhoto || u.avatar || (Array.isArray(u.photos) && u.photos[0]) || null;
  if (candidate) {
    const norm = toWebPath(candidate);
    u.profilePicture = norm;
    // Keep legacy alias in sync for FE that reads profilePhoto
    if (!u.profilePhoto) u.profilePhoto = norm;
  }
  return u;
}

/** Ensure there is a stable `id` string alongside `_id`. */
export function ensureStringId(u) {
  if (!u.id && u._id) {
    try {
      u.id = String(u._id);
    } catch {
      /* ignore stringify issues */
    }
  }
  return u;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Main normalizer
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Normalize a single user for API output.
 * @param {Object|import('mongoose').Document} src
 * @returns {Object} normalized user (plain object)
 */
export default function normalizeUserOut(src = {}) {
  // Always start from a plain object; do not mutate the original document.
  const user = src && typeof src.toObject === "function" ? src.toObject() : { ...src };

  // 1) Remove sensitive fields
  stripSensitive(user);

  // 2) Guarantee array fields + canonicalize paths
  ensureArrayFields(user);

  // 3) Normalize avatar-ish fields and keep aliases consistent
  ensureCanonicalAvatar(user);

  // 4) Provide a stable string id
  ensureStringId(user);

  // Done — return the normalized user (no field whitelisting!)
  return user;
}

/**
 * Normalize an array of users; order is preserved and falsy entries are dropped.
 * @param {Array} arr
 * @returns {Array}
 */
export function normalizeUsersOut(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const u of arr) {
    if (!u) continue;
    out.push(normalizeUserOut(u));
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Defensive exports (keep API stable if other modules import helpers directly)
 * ────────────────────────────────────────────────────────────────────────────*/

// Named re-exports are already present above; keep default at bottom for clarity.
// --- REPLACE END ---
