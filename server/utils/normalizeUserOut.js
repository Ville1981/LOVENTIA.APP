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
 * Premium safety rules:
 *  • NEVER overwrite stored premium fields destructively.
 *  • Only *fill gaps* if fields are missing/undefined:
 *      – If `isPremium === true` and entitlements.tier is missing/"free" → lift to "premium".
 *      – Fill only missing premium features to true (at least `noAds`); never flip true→false.
 *      – If `isPremium` is missing (not boolean), compute effective view and set it.
 *      – Mirror legacy `premium` from `isPremium` if missing.
 *  • Keep `entitlements.features.superLikesPerWeek` as a NUMBER if present; never coerce to boolean.
 *  • DO NOT remove `subscriptionId`.
 *
 * Rewind rules:
 *  • If `rewind` exists, expose a stable view with:
 *      – `max` (number, default 50)
 *      – `stackCount` (length of raw stack)
 *      – `stack` preview array (first 10 items) with normalized alias fields:
 *          { type, action, targetId, targetUserId, createdAt }
 *  • Accept legacy aliases in items: type↔action, targetId↔target/targetUserId/target_id, createdAt↔at.
 *  • Do NOT hide `rewind` (visibility required by FE & diagnostics).
 */

"use strict";

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
  delete u.passwordResetUsedAt;
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
 *  - If premium: set only missing features to true (at least `noAds`); never flip true→false.
 *  - Preserve quotas and any existing features.
 *  - Ensure `features.superLikesPerWeek` stays a NUMBER when present; do not coerce to boolean.
 *  - Never remove/alter `subscriptionId`.
 */
export function applyEntitlementsView(u) {
  const effectivePremium = !!u.isPremium || computeEffectivePremiumView(u);
  const ent = u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
  const features = ent.features && typeof ent.features === "object" ? { ...ent.features } : {};
  const quotas = ent.quotas && typeof ent.quotas === "object" ? { ...ent.quotas } : undefined;

  // Lift tier only if missing or clearly "free"
  const currentTier = ent.tier;
  const shouldLiftTier =
    effectivePremium &&
    (currentTier === undefined || currentTier === null || String(currentTier).toLowerCase() === "free");

  const nextEnt = {
    ...(ent || {}),
    tier: shouldLiftTier ? "premium" : currentTier ?? ent.tier,
  };

  // If premium, fill only missing features (minimal set: at least noAds)
  if (effectivePremium) {
    if (features.noAds === undefined || features.noAds === null) {
      features.noAds = true;
    }
  }

  // Ensure superLikesPerWeek remains numeric when present
  if (features.superLikesPerWeek !== undefined && features.superLikesPerWeek !== null) {
    const n = Number(features.superLikesPerWeek);
    if (Number.isFinite(n)) {
      features.superLikesPerWeek = n;
    } else {
      // If somehow stored as boolean true in DB, keep it truthy (client may still treat premium as unlimited),
      // but *prefer* to coerce to a sane numeric view (do NOT persist here).
      features.superLikesPerWeek = features.superLikesPerWeek === true ? 3 : 0;
    }
  }

  nextEnt.features = features;
  if (quotas) {
    // Ensure quotas.superLikes { used, window } are visible with sensible defaults
    const q = { ...quotas };
    const sl = { ...(q.superLikes || {}) };
    if (!Number.isFinite(Number(sl.used))) sl.used = 0;
    if (typeof sl.window !== "string" || !sl.window) sl.window = "weekly";
    q.superLikes = sl;
    nextEnt.quotas = q;
  }

  u.entitlements = nextEnt;
  return u;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Rewind normalization (stack preview + count; accepts legacy aliases)
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * Ensure a stable `rewind` view exists for API:
 *  - `max`: number (default 50 if absent)
 *  - `stackCount`: raw stack length
 *  - `stack`: first N items with normalized aliases (type/action, targetId/targetUserId/target/target_id, createdAt/at)
 * This function is non-destructive for unknown fields on `rewind`.
 */
export function ensureRewindView(u, previewLimit = 10) {
  const rw = (u && typeof u.rewind === "object") ? u.rewind : undefined;

  // If no rewind object at all, provide an empty view (do not fabricate data).
  if (!rw) {
    u.rewind = {
      max: 50,
      stackCount: 0,
      stack: []
    };
    return u;
  }

  // Accept arrays or object-like `{0:...,1:...}` stacks
  const rawStack = Array.isArray(rw.stack) ? rw.stack : asArray(rw.stack);

  const max = Number.isFinite(Number(rw.max)) ? Number(rw.max) : 50;

  // Preview: limit to first N to keep payloads tight
  const preview = rawStack.slice(0, Math.max(0, Number(previewLimit) || 10)).map((a) => ({
    type: a?.type ?? a?.action ?? "like",
    action: a?.action ?? a?.type ?? "like",
    targetId: a?.targetId ?? a?.targetUserId ?? a?.target ?? a?.target_id ?? null,
    targetUserId: a?.targetUserId ?? a?.targetId ?? a?.target ?? a?.target_id ?? null,
    createdAt: a?.createdAt ?? a?.at ?? null,
  }));

  u.rewind = {
    ...rw,
    max,
    stackCount: rawStack.length,
    stack: preview,
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

  // 5) Rewind stable view (stackCount + preview), accepting legacy aliases
  ensureRewindView(user, 10); // preview first 10 items

  // 6) Premium top-level safety (gap-filling only)
  applyPremiumSafety(user);

  // 7) Non-destructive entitlements merge for output (lift tier + fill missing premium features)
  applyEntitlementsView(user);

  // 8) Email verification view for client (derived, non-sensitive)
  user.emailVerified = Boolean(user.emailVerifiedAt);
  user.emailVerifiedAt = user.emailVerifiedAt || null;

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

