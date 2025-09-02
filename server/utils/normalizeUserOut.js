// --- REPLACE START: unified user normalizer (NO field cutting; keep photos==extraImages, POSIX paths, no dupes) ---
/**
 * Unified user normalizer for API output.
 *
 * Goals (very important):
 *  - DO NOT cut profile fields. Always start from the full source object.
 *  - Only compute/overwrite a few consistent fields:
 *      • profilePicture/profilePhoto/avatar → one normalized avatar path (POSIX + leading slash).
 *      • photos & extraImages → merge, clean (POSIX, leading slash, uniq) and mirror to be identical.
 *      • visibility → merge isHidden/hiddenUntil/resumeOnLogin into a stable object but keep legacy flags too.
 *  - Preserve all other domain fields exactly as they are (orientation, height, weight, bodyType, education,
 *    professionCategory, profession, religion, religionImportance, children, pets, smoke, drink, drugs,
 *    activityLevel, goal, lookingFor, lat/lng… etc.). No whitelist anywhere.
 *  - Work with both Mongoose documents and plain objects.
 *  - Keep comments and naming in English to ease maintenance.
 */

/* ----------------------------- Path helpers ----------------------------- */

/** Convert Windows backslashes to forward slashes. */
function toPosix(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/') : p;
}

/**
 * Ensure a path begins with "/" if it looks like a local relative path.
 * We do NOT guess domains; we only prefix when path is clearly local (e.g., "uploads/...").
 */
function ensureLeadingSlash(p) {
  if (typeof p !== 'string' || p.length === 0) return p;
  const posix = toPosix(p);
  if (/^https?:\/\//i.test(posix)) return posix; // already absolute URL
  return posix.startsWith('/') ? posix : '/' + posix;
}

/**
 * Clean an array of path strings:
 *  - drop falsy values
 *  - convert to POSIX
 *  - ensure leading slash (for local paths)
 *  - deduplicate while preserving order
 */
function cleanPhotoList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (!raw) continue;
    const posix = toPosix(raw);
    const norm = ensureLeadingSlash(posix);
    if (!norm || norm === '/') continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

/* ----------------------------- Scalar helpers ----------------------------- */

/** Safe boolean casting (preserves explicit booleans; otherwise uses fallback). */
function bool(v, fallback = false) {
  return typeof v === 'boolean' ? v : !!fallback;
}

/** String helper to keep non-empty strings or fallback. */
function str(val, fallback = '') {
  return typeof val === 'string' && val.length > 0 ? val : fallback;
}

/* ----------------------------- Main normalizer ----------------------------- */

/**
 * Normalize a single user for API output.
 * We start from the full source (NO whitelist) and only normalize a few well-defined keys.
 *
 * @param {Object|import('mongoose').Document} u - User doc or plain object.
 * @returns {Object|null} normalized plain object or null if input is falsy.
 */
export function normalizeUserOut(u) {
  if (!u) return null;

  // Start from the full object (NO field cutting).
  const src = typeof u.toObject === 'function' ? u.toObject() : u;

  // Compute a shallow copy so we do not mutate the original.
  const out = { ...src };

  // --- Identity: keep both _id and a string id helper ---
  out.id = String(src._id || src.id || '');

  // --- Avatar resolution (do not drop original avatar field; just normalize exposed picture fields) ---
  const avatarRaw = src.profilePicture ?? src.profilePhoto ?? src.avatar ?? null;
  const avatar = avatarRaw ? ensureLeadingSlash(toPosix(avatarRaw)) : null;
  if (avatar) {
    out.profilePicture = avatar;
    out.profilePhoto = avatar; // legacy alias for FE
    // Keep src.avatar as-is if it exists; we do NOT delete fields.
  }

  // --- Photos: merge both arrays, clean & dedupe, then mirror to BOTH fields ---
  const photoInputs = []
    .concat(Array.isArray(src.photos) ? src.photos : [])
    .concat(Array.isArray(src.extraImages) ? src.extraImages : []);
  const photosClean = cleanPhotoList(photoInputs);
  out.photos = photosClean;
  out.extraImages = photosClean;

  // --- Visibility: produce a stable object while preserving top-level flags for compatibility ---
  const vis = src.visibility || {};
  const resolvedHidden =
    typeof src.isHidden === 'boolean'
      ? src.isHidden
      : typeof vis.isHidden === 'boolean'
      ? vis.isHidden
      : false;

  const resolvedHiddenUntil =
    src.hiddenUntil !== undefined ? src.hiddenUntil : vis.hiddenUntil ?? null;

  const resolvedResumeOnLogin =
    typeof vis.resumeOnLogin === 'boolean'
      ? vis.resumeOnLogin
      : typeof src.resumeOnLogin === 'boolean'
      ? src.resumeOnLogin
      : false;

  out.visibility = {
    ...vis, // preserve any additional visibility fields that may exist
    isHidden: !!resolvedHidden,
    hiddenUntil: resolvedHiddenUntil || null,
    resumeOnLogin: !!resolvedResumeOnLogin,
  };

  // Keep original flags too (no data loss), but normalize their truthiness if present
  if ('isHidden' in src) out.isHidden = !!src.isHidden;
  if ('resumeOnLogin' in src) out.resumeOnLogin = !!src.resumeOnLogin;
  if ('hiddenUntil' in src) out.hiddenUntil = src.hiddenUntil ?? null;

  // --- Premium flags: keep both fields, normalized booleans ---
  // (We DO NOT remove either one; we just ensure a consistent boolean view.)
  const isPrem = bool(src.isPremium, src.premium);
  const prem = bool(src.premium, src.isPremium);
  out.isPremium = isPrem;
  out.premium = prem;

  // --- Country/Region/City: prefer top-level but mirror from nested location if missing ---
  const loc = src.location || {};
  const country = src.country ?? loc.country ?? '';
  const region = src.region ?? loc.region ?? '';
  const city = src.city ?? loc.city ?? '';
  out.country = country;
  out.region = region;
  out.city = city;

  // Keep a normalized location object (do not remove existing keys)
  out.location = {
    ...(typeof loc === 'object' && loc ? loc : {}),
    country,
    region,
    city,
  };

  // --- Minor safe defaults for a few common fields (without cutting anything) ---
  out.summary = str(src.summary, out.summary || '');
  out.politicalIdeology = str(src.politicalIdeology, out.politicalIdeology || '');
  if (!Array.isArray(out.nutritionPreferences)) {
    out.nutritionPreferences = Array.isArray(src.nutritionPreferences)
      ? src.nutritionPreferences
      : [];
  }

  // NOTE: We intentionally do NOT transform other domain fields (orientation, height, weight, bodyType,
  // education, professionCategory, profession, religion, religionImportance, children, pets, smoke,
  // drink, drugs, activityLevel, goal, lookingFor, lat/lng, etc.). They remain exactly as stored.

  return out;
}

/**
 * Normalize an array of users. Keeps order and drops falsy entries.
 * @param {Array<Object>} arr
 * @returns {Array<Object>}
 */
export function normalizeUsersOut(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const u of arr) {
    const n = normalizeUserOut(u);
    if (n) out.push(n);
  }
  return out;
}

export default normalizeUserOut;
// --- REPLACE END ---
