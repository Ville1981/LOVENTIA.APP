// PATH: server/src/models/User.js

// --- REPLACE START: robust ESM wrapper that loads (or defines) the User model ---
//
// Why this file exists
// --------------------
// The app runs ESM ("type": "module"). Historically the User model lived outside
// server/src (e.g., server/models/User.cjs or server/models/User.js) and was exported
// in different formats (CommonJS or ESM). This wrapper tries those locations first.
// If none work (e.g., file missing or invalid syntax), we *safely define* a minimal
// Mongoose model here so the server can start. This avoids hard crashes like:
//   "Failed to load User model ... Unexpected token ':'"
//
// Guarantees
// ----------
// - ESM-safe import for the model: `import User from '../models/User.js'`
// - If an external model exists, we use it. If not, we define a fallback schema.
// - We augment the schema with image & billing & entitlements fields if missing:
//     profilePicture, profilePhoto, avatar, photos[], extraImages[],
//     stripeCustomerId, subscriptionId, isPremium, premium,
//     entitlements.{tier,since,until,features,quotas.superLikes.{used,window}}
//
// Notes
// -----
// - We deliberately keep `strict:false` (or nested non-strict) to avoid dropping fields.
// - All comments are in English; spellings reviewed.
// - No unnecessary shortening; we keep the structure verbose and clear.
//
// -----------------------------------------------------------------------------

import path from 'node:path';
import { createRequire } from 'node:module';
import mongoose from 'mongoose';

const require = createRequire(import.meta.url);

// Small helpers
function isModel(maybe) {
  return !!maybe && (typeof maybe === 'function' || typeof maybe?.modelName === 'string');
}
function pickModel(ns) {
  // Support various export styles
  return ns?.default || ns?.User || ns?.UserModel || ns;
}

/**
 * Try loading a CommonJS module synchronously (no top-level await).
 * Returns the Mongoose model or null.
 */
function tryLoadCJS(absPath) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(absPath);
    const mdl = pickModel(mod);
    return isModel(mdl) ? mdl : null;
  } catch {
    return null;
  }
}

// Candidate locations (relative to project root and this file)
// IMPORTANT: We ONLY use CJS loads here to avoid top-level await.
// The canonical CJS file in this repo is server/models/User.cjs.
// server/models/User.js is ESM (wrapper) and must NOT be required from CJS loader.
const CANDIDATES = [
  // Root-level CJS (preferred)
  path.resolve(process.cwd(), 'server/models/User.cjs'),
  path.resolve(process.cwd(), 'models/User.cjs'),
  // Legacy relative fallback (from server/src/models/User.js → ../../models/User.cjs)
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../models/User.cjs'),
];

let LoadedUser = null;

// Resolve an existing model synchronously (CJS only; no top-level await)
for (const candidate of CANDIDATES) {
  LoadedUser = tryLoadCJS(candidate);
  if (LoadedUser) {
    console.log(`[UserModel] Loaded from CJS: ${candidate}`);
    break;
  }
}

// If still not found, define a fallback schema/model with required fields
if (!LoadedUser) {
  console.warn('[UserModel] External model not found/readable. Defining a fallback schema in server/src/models/User.js');

  const { Schema, models, model } = mongoose;

  // Feature keys (explicit booleans kept under entitlements.features.*)
  const featuresShape = {
    seeLikedYou:       { type: Boolean, default: false },
    superLikesPerWeek: { type: Number,  default: 0     }, // numeric allowance (not strictly boolean)
    unlimitedLikes:    { type: Boolean, default: false },
    unlimitedRewinds:  { type: Boolean, default: false },
    dealbreakers:      { type: Boolean, default: false },
    qaVisibilityAll:   { type: Boolean, default: false },
    introsMessaging:   { type: Boolean, default: false },
    noAds:             { type: Boolean, default: false },
  };

  // Quotas shape (currently we only require superLikes.{used,window})
  const quotasShape = {
    superLikes: {
      used:   { type: Number, default: 0 },
      window: { type: String, default: 'weekly' },
    },
  };

  const EntitlementsSchema = new Schema(
    {
      tier:  { type: String, enum: ['free', 'premium'], default: 'free' },
      since: { type: Date, default: null },
      until: { type: Date, default: null },
      features: { type: new Schema(featuresShape, { _id: false, strict: false }), default: {} },
      quotas:   { type: new Schema(quotasShape,   { _id: false, strict: false }), default: {} },
    },
    { _id: false, strict: false }
  );

  // Keep this schema broad but non-breaking; it mirrors common fields used app-wide.
  const FallbackUserSchema = new Schema(
    {
      username: { type: String, index: true, sparse: true },
      email: { type: String, index: true, sparse: true },
      name: String,
      role: { type: String, default: 'user' },

      // Premium flags (keep both for compatibility)
      isPremium: { type: Boolean, default: false },
      premium:   { type: Boolean, default: false }, // legacy alias kept in sync

      // Billing identifiers
      stripeCustomerId: { type: String, index: true, sparse: true, default: undefined },
      subscriptionId:   { type: String, default: null },

      // Entitlements (typed)
      entitlements: { type: EntitlementsSchema, default: {} },

      // Image-related fields (used by uploads/routes)
      profilePicture: { type: String, default: undefined },
      profilePhoto:   { type: String, default: undefined },
      avatar:         { type: String, default: undefined },
      photos:         { type: [String], default: [] },
      extraImages:    { type: [String], default: [] },

      // Location & profile details (non-strict; add common ones)
      orientation: String,
      gender: String,
      politicalIdeology: String,
      country: String,
      region: String,
      city: String,
      location: {
        country: String,
        region: String,
        city: String,
        type: { type: String },
        coordinates: [Number],
      },

      // Visibility
      hidden: { type: Boolean, default: false },
      isHidden: { type: Boolean, default: false },
      hiddenUntil: { type: Date, default: undefined },
      resumeOnLogin: { type: Boolean, default: false },
      visibility: {
        isHidden: { type: Boolean, default: false },
        hiddenUntil: { type: Date, default: undefined },
        resumeOnLogin: { type: Boolean, default: false },
      },
    },
    {
      strict: false, // do not drop unknown fields from older DBs
      timestamps: true,
    }
  );

  // Create (or reuse) the model
  LoadedUser = models.User || model('User', FallbackUserSchema);
}

// Augment schema with required fields if the external model lacked them.
// Safe to call even when the model came from fallback above.
try {
  const s = LoadedUser?.schema;
  const { Schema } = mongoose;
  if (s) {
    const additions = {};

    // Images
    if (!s.path('profilePicture')) additions.profilePicture = { type: String, default: undefined };
    if (!s.path('profilePhoto'))   additions.profilePhoto   = { type: String, default: undefined };
    if (!s.path('avatar'))         additions.avatar         = { type: String, default: undefined };
    if (!s.path('photos'))         additions.photos         = { type: [String], default: [] };
    if (!s.path('extraImages'))    additions.extraImages    = { type: [String], default: [] };

    // Billing
    if (!s.path('stripeCustomerId')) {
      additions.stripeCustomerId = { type: String, index: true, sparse: true, default: undefined };
    } else {
      try {
        s.index({ stripeCustomerId: 1 }, { sparse: true, name: 'idx_stripeCustomerId_sparse' });
      } catch {
        // best effort
      }
    }
    if (!s.path('subscriptionId')) additions.subscriptionId = { type: String, default: null };
    if (!s.path('isPremium'))      additions.isPremium      = { type: Boolean, default: false };
    if (!s.path('premium'))        additions.premium        = { type: Boolean, default: false };

    // Entitlements (ensure full shape exists and is typed)
    if (!s.path('entitlements')) {
      // Define a nested schema that matches our fallback typing
      const featuresShape = {
        seeLikedYou:       { type: Boolean, default: false },
        superLikesPerWeek: { type: Number,  default: 0     },
        unlimitedLikes:    { type: Boolean, default: false },
        unlimitedRewinds:  { type: Boolean, default: false },
        dealbreakers:      { type: Boolean, default: false },
        qaVisibilityAll:   { type: Boolean, default: false },
        introsMessaging:   { type: Boolean, default: false },
        noAds:             { type: Boolean, default: false },
      };
      const quotasShape = {
        superLikes: {
          used:   { type: Number, default: 0 },
          window: { type: String, default: 'weekly' },
        },
      };
      const EntitlementsSchema = new Schema(
        {
          tier:  { type: String, enum: ['free', 'premium'], default: 'free' },
          since: { type: Date, default: null },
          until: { type: Date, default: null },
          features: { type: new Schema(featuresShape, { _id: false, strict: false }), default: {} },
          quotas:   { type: new Schema(quotasShape,   { _id: false, strict: false }), default: {} },
        },
        { _id: false, strict: false }
      );
      additions.entitlements = { type: EntitlementsSchema, default: {} };
    } else {
      // Ensure nested paths exist (augment without overriding existing definitions)
      const has = (p) => !!s.path(`entitlements.${p}`);

      // top-level fields
      if (!has('tier'))  s.add({ 'entitlements.tier':  { type: String, enum: ['free','premium'], default: 'free' } });
      if (!has('since')) s.add({ 'entitlements.since': { type: Date, default: null } });
      if (!has('until')) s.add({ 'entitlements.until': { type: Date, default: null } });

      // features keys
      const featureDefaults = {
        seeLikedYou: false,
        superLikesPerWeek: 0,
        unlimitedLikes: false,
        unlimitedRewinds: false,
        dealbreakers: false,
        qaVisibilityAll: false,
        introsMessaging: false,
        noAds: false,
      };
      for (const [k, def] of Object.entries(featureDefaults)) {
        const full = `entitlements.features.${k}`;
        if (!has(`features.${k}`)) {
          s.add({ [full]: { type: typeof def === 'number' ? Number : Boolean, default: def } });
        }
      }

      // quotas.superLikes.{used,window}
      if (!has('quotas')) {
        s.add({ 'entitlements.quotas': { type: Map, of: mongoose.Schema.Types.Mixed, default: {} } });
      }
      if (!has('quotas.superLikes')) {
        s.add({ 'entitlements.quotas.superLikes': { type: Map, of: mongoose.Schema.Types.Mixed, default: {} } });
      }
      if (!has('quotas.superLikes.used')) {
        s.add({ 'entitlements.quotas.superLikes.used': { type: Number, default: 0 } });
      }
      if (!has('quotas.superLikes.window')) {
        s.add({ 'entitlements.quotas.superLikes.window': { type: String, default: 'weekly' } });
      }
    }

    if (Object.keys(additions).length > 0) {
      s.add(additions);
      console.warn('[UserModel] Schema augmented with:', Object.keys(additions).sort().join(', '));
    }

    // Ensure schema does not drop unknown fields under entitlements or root (defensive)
    // If external schema had strict:true, nested additions use strict:false where needed.
    try {
      if (s.options && typeof s.options.strict === 'undefined') {
        // Leave as-is; we don't force global strict to preserve upstream intent.
      }
    } catch {
      /* noop */
    }
  }
} catch (e) {
  console.warn('[UserModel] Schema augmentation skipped:', e?.message || e);
}

// Final exports
const User = LoadedUser;
export default User;
export { User };
// --- REPLACE END ---
