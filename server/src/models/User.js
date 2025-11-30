// PATH: server/src/models/User.js

// --- REPLACE START: robust ESM wrapper that loads (or defines) the User model ---
/* eslint-disable no-console */
/**
 * ESM wrapper for the User model.
 *
 * Responsibilities:
 * 1. Try to load the **real** model from CJS/JS locations outside src/, for example:
 *      - server/models/User.cjs
 *      - server/models/User.js
 *      - models/User.cjs
 *      - models/User.js
 * 2. If all of those fail → define a BROAD fallback schema here (strict: false) so the app keeps running.
 * 3. Augment the loaded schema with missing common fields (images, billing, entitlements, password reset, rewind).
 *
 * Guarantees (even with strict schemas):
 *   - entitlements.features.superLikesPerWeek: Number (default 3)
 *   - entitlements.quotas.superLikes: { used: Number (default 0), weekKey: String (''), window: String ('') }
 *   - rewind.stack / rewind.max added **only if missing** (non-breaking augment)
 *
 * This file must stay ESM because the rest of src/ imports it as:
 *    import User from '../models/User.js'
 */

'use strict';

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

const require = createRequire(import.meta.url);

function isModel(maybe) {
  return !!maybe && (typeof maybe === 'function' || typeof maybe?.modelName === 'string');
}
function pickModel(ns) {
  return ns?.default || ns?.User || ns?.UserModel || ns;
}
function tryLoadCJS(absPath) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(absPath);
    const mdl = pickModel(mod);
    if (isModel(mdl)) {
      console.log(`[UserModel] Loaded from: ${absPath}`);
      return mdl;
    }
    return null;
  } catch {
    return null;
  }
}

// Normalize dirs to support Windows & POSIX
const PROJECT_ROOT = process.cwd();
const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Candidate paths (CJS/JS) for external model
const CANDIDATES = [
  path.resolve(PROJECT_ROOT, 'server/models/User.cjs'),
  path.resolve(PROJECT_ROOT, 'server/models/User.js'),
  path.resolve(PROJECT_ROOT, 'models/User.cjs'),
  path.resolve(PROJECT_ROOT, 'models/User.js'),
  path.resolve(THIS_DIR, '../../models/User.cjs'),
  path.resolve(THIS_DIR, '../../models/User.js'),
];

let LoadedUser = null;

// Try all candidates in order
for (const candidate of CANDIDATES) {
  LoadedUser = tryLoadCJS(candidate);
  if (LoadedUser) break;
}

if (!LoadedUser) {
  console.warn('[UserModel] External model not found/readable. Defining a fallback schema in server/src/models/User.js');

  const { Schema, models, model } = mongoose;

  // --- Fallback schema defines entitlements/features + quotas with correct types ---
  const featuresShape = {
    seeLikedYou:       { type: Boolean, default: false },
    superLikesPerWeek: { type: Number,  default: 3 },        // default 3 to match app expectations
    unlimitedLikes:    { type: Boolean, default: false },
    unlimitedRewinds:  { type: Boolean, default: false },
    dealbreakers:      { type: Boolean, default: false },
    qaVisibilityAll:   { type: Boolean, default: false },
    introsMessaging:   { type: Boolean, default: false },
    noAds:             { type: Boolean, default: false },
  };

  const quotasShape = {
    superLikes: {
      used:    { type: Number, default: 0 },                 // required field for quota persistence
      weekKey: { type: String, default: '' },                // ISO week key, e.g. "2025-W45"
      window:  { type: String, default: '' },                // legacy alias of weekKey
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

  const FallbackUserSchema = new Schema(
    {
      username: { type: String, index: true, sparse: true },
      email:    { type: String, index: true, sparse: true },
      name:     { type: String },
      role:     { type: String, default: 'user' },

      // Premium flags
      isPremium: { type: Boolean, default: false },
      premium:   { type: Boolean, default: false },

      // Billing
      stripeCustomerId: { type: String, index: true, sparse: true, default: null },
      subscriptionId:   { type: String, default: null },
      billing: {
        stripeCustomerId: { type: String, default: null },
      },

      // Entitlements
      entitlements: { type: EntitlementsSchema, default: {} },

      // Media
      profilePicture: { type: String, default: undefined },
      profilePhoto:   { type: String, default: undefined },
      avatar:         { type: String, default: undefined },
      photos:         { type: [String], default: [] },
      extraImages:    { type: [String], default: [] },

      // Password reset
      passwordResetToken:   { type: String, index: true, sparse: true, default: undefined },
      passwordResetExpires: { type: Date, default: null },
      passwordResetUsedAt:  { type: Date, default: null },

      // Visibility
      hidden:        { type: Boolean, default: false },
      isHidden:      { type: Boolean, default: false },
      hiddenUntil:   { type: Date, default: undefined },
      resumeOnLogin: { type: Boolean, default: false },
      visibility: {
        isHidden:      { type: Boolean, default: false },
        hiddenUntil:   { type: Date, default: undefined },
        resumeOnLogin: { type: Boolean, default: false },
      },

      // ✅ Rewind (fallback definition so Like → Rewind flow always works)
      rewind: {
        stack: [
          {
            action: { type: String, default: 'like' }, // 'like' | 'pass' | 'superlike' (optional)
            target: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            at:     { type: Date, default: () => new Date() },
          },
        ],
        max: { type: Number, default: 50 },
      },
    },
    {
      strict: false,
      timestamps: true,
    }
  );

  LoadedUser = models.User || model('User', FallbackUserSchema);
} else {
  // Augment loaded schema with any missing fields (non-breaking)
  try {
    const s = LoadedUser?.schema;
    const { Schema } = mongoose;
    if (s) {
      const additions = {};

      // Media & password reset helpers
      if (!s.path('profilePicture')) additions.profilePicture = { type: String, default: undefined };
      if (!s.path('profilePhoto'))   additions.profilePhoto   = { type: String, default: undefined };
      if (!s.path('avatar'))         additions.avatar         = { type: String, default: undefined };
      if (!s.path('photos'))         additions.photos         = { type: [String], default: [] };
      if (!s.path('extraImages'))    additions.extraImages    = { type: [String], default: [] };

      if (!s.path('passwordResetToken')) {
        additions.passwordResetToken = { type: String, index: true, sparse: true, default: undefined };
      }
      if (!s.path('passwordResetExpires')) {
        additions.passwordResetExpires = { type: Date, default: null };
      }
      if (!s.path('passwordResetUsedAt')) {
        additions.passwordResetUsedAt = { type: Date, default: null };
      }

      // Billing: canonical nested + legacy top-level for compatibility
      if (!s.path('billing.stripeCustomerId')) {
        s.add({ 'billing.stripeCustomerId': { type: String, default: null } });
        console.warn('[UserModel] Schema augmented with: billing.stripeCustomerId');
      }
      if (!s.path('stripeCustomerId')) {
        s.add({ stripeCustomerId: { type: String, default: null } });
      }
      if (!s.path('subscriptionId')) {
        s.add({ subscriptionId: { type: String, default: null } });
      }

      // Ensure ENTITLEMENTS exists; if not, add a minimal, non-breaking sub-schema
      const needEntitlements = !s.path('entitlements');
      if (needEntitlements) {
        const FeaturesSub = new Schema(
          {
            seeLikedYou:       { type: Boolean, default: false },
            superLikesPerWeek: { type: Number,  default: 3 },       // default 3 to match app expectations
            unlimitedLikes:    { type: Boolean, default: false },
            unlimitedRewinds:  { type: Boolean, default: false },
            dealbreakers:      { type: Boolean, default: false },
            qaVisibilityAll:   { type: Boolean, default: false },
            introsMessaging:   { type: Boolean, default: false },
            noAds:             { type: Boolean, default: false },
          },
          { _id: false, strict: false }
        );

        const QuotasSub = new Schema(
          {
            superLikes: {
              used:    { type: Number, default: 0 },                // required for quota persistence
              weekKey: { type: String, default: '' },
              window:  { type: String, default: '' },               // legacy alias of weekKey
            },
          },
          { _id: false, strict: false }
        );

        const EntitlementsSub = new Schema(
          {
            tier:  { type: String, enum: ['free', 'premium'], default: 'free' },
            since: { type: Date, default: null },
            until: { type: Date, default: null },
            features: { type: FeaturesSub, default: {} },
            quotas:   { type: QuotasSub,   default: {} },
          },
          { _id: false, strict: false }
        );

        additions.entitlements = { type: EntitlementsSub, default: {} };
      } else {
        // Even if entitlements exists, guarantee required subpaths in strict schemas
        if (!s.path('entitlements.features.superLikesPerWeek')) {
          s.add({ 'entitlements.features.superLikesPerWeek': { type: Number, default: 3 } });
        }
        if (!s.path('entitlements.quotas.superLikes.used')) {
          s.add({ 'entitlements.quotas.superLikes.used': { type: Number, default: 0 } });
        }
        if (!s.path('entitlements.quotas.superLikes.weekKey')) {
          s.add({ 'entitlements.quotas.superLikes.weekKey': { type: String, default: '' } });
        }
        if (!s.path('entitlements.quotas.superLikes.window')) {
          s.add({ 'entitlements.quotas.superLikes.window': { type: String, default: '' } });
        }
      }

      // ✅ NEW: Rewind augment — only add if the paths are missing (non-breaking)
      if (!s.path('rewind.stack')) {
        s.add({
          'rewind.stack': [
            {
              action: { type: String, default: 'like' },
              target: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
              at:     { type: Date, default: () => new Date() },
            },
          ],
        });
        console.warn('[UserModel] Schema augmented with: rewind.stack');
      }
      if (!s.path('rewind.max')) {
        s.add({ 'rewind.max': { type: Number, default: 50 } });
        console.warn('[UserModel] Schema augmented with: rewind.max');
      }

      if (Object.keys(additions).length) {
        s.add(additions);
        console.warn('[UserModel] Schema augmented with:', Object.keys(additions).sort().join(', '));
      }
    }
  } catch (e) {
    console.warn('[UserModel] Schema augmentation skipped:', e?.message || e);
  }
}

const User = LoadedUser;
export default User;
export { User };
// --- REPLACE END ---


