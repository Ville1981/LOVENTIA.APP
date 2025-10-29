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
 * Premium safety rules:
 *  • NEVER overwrite stored premium fields destructively.
 *  • Only *fill gaps* if fields are missing/undefined:
 *      – If `isPremium === true` and entitlements.tier is missing/"free" → lift to "premium".
 *      – Fill only missing premium features to true (at least `noAds`); never flip true→false.
 *      – If `isPremium` is missing (not boolean), compute effective view and set it.
 *      – Mirror legacy `premium` from `isPremium` if missing.
 *  • DO NOT remove `subscriptionId`.
 *
 * Implementation notes:
 *  • Keep comments & strings in English.
 *  • Expose helpers (toWebPath, normalizeUsersOut) for reuse in routes/controllers.
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
 *  - If it's a plain object → use Object.values(v) (handles `{0:'a',1:'b'}` from bad serialization)
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
  const candidate =
    u.profilePicture ||
    u.profilePhoto ||
    u.avatar ||
    (Array.isArray(u.photos) && u.photos[0]) ||
    null;

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
 * Premium logic (effective view + non-destructive entitlements merge)
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Compute effective premium without mutating source:
 *  1) if user.isPremium === true → premium
 *  2) else if entitlements.tier === 'premium' AND entitlements.until > now → premium
 *  3) otherwise free
 */
function computeEffectivePremiumView(u) {
  try {
    if (u?.isPremium === true) return true;
    const ent = u?.entitlements || {};
    const tier = ent?.tier;
    const untilRaw = ent?.until;
    if (tier === "premium" && untilRaw) {
      const until = new Date(untilRaw);
      if (!Number.isNaN(+until) && until.getTime() > Date.now()) return true;
    }
    return false;
  } catch {
    return !!u?.isPremium;
  }
}

/**
 * Fill only missing premium flags (top-level isPremium/premium mirrors).
 * DO NOT touch entitlements content here.
 */
export function applyPremiumSafety(u) {
  const hasIsPremium = typeof u.isPremium === "boolean";
  if (!hasIsPremium) {
    u.isPremium = computeEffectivePremiumView(u);
  }
  const hasLegacyPremium = typeof u.premium === "boolean";
  if (!hasLegacyPremium) {
    u.premium = !!u.isPremium;
  }
  return u;
}

/**
 * Non-destructive entitlements merge for output:
 *  - Ensure u.entitlements object exists.
 *  - If user is premium (effective view) and entitlements.tier is missing/"free", lift to "premium".
 *  - If premium: set only missing premium features to true (at least `noAds`); never flip true→false.
 *  - Preserve quotas and any existing features.
 *  - Never remove/alter `subscriptionId`.
 */
export function applyEntitlementsView(u) {
  const effectivePremium = !!u.isPremium || computeEffectivePremiumView(u);
  const ent = u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
  const features = ent.features && typeof ent.features === "object" ? ent.features : {};
  const quotas = ent.quotas && typeof ent.quotas === "object" ? ent.quotas : ent.quotas ?? undefined;

  // Lift tier only if missing or clearly "free"
  const currentTier = ent.tier;
  const shouldLiftTier =
    effectivePremium &&
    (currentTier === undefined || currentTier === null || String(currentTier).toLowerCase() === "free");

  if (shouldLiftTier) {
    ent.tier = "premium";
  } else if (currentTier !== undefined) {
    ent.tier = currentTier; // keep as-is if already set (including "premium")
  }

  // If premium, fill only missing features (minimal set: at least noAds)
  if (effectivePremium) {
    if (features.noAds === undefined || features.noAds === null) {
      features.noAds = true;
    }
    // Optionally prefill more premium features here (ONLY when missing):
    // const premiumDefaults = {
    //   unlimitedLikes: true,
    //   unlimitedRewinds: true,
    //   dealbreakers: true,
    //   seeLikedYou: true,
    //   qaVisibilityAll: true,
    //   introsMessaging: true,
    //   noAds: true,
    // };
    // for (const [k, v] of Object.entries(premiumDefaults)) {
    //   if (features[k] === undefined || features[k] === null) features[k] = v;
    // }
  }

  // Re-attach objects (avoid mutating shared references if upstream used frozen objects)
  u.entitlements = {
    ...ent,
    features: { ...features },
    ...(quotas ? { quotas } : {}), // keep quotas object if present
  };

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
export function normalizeUserOut(src = {}) {
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

  // 5) Premium top-level safety (gap-filling only)
  applyPremiumSafety(user);

  // 6) Non-destructive entitlements merge for output (lift tier + fill missing premium features)
  applyEntitlementsView(user);

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

// Keep a default export alias for compatibility with `import normalizeUserOut from ...`
export default normalizeUserOut;
// --- REPLACE END ---

