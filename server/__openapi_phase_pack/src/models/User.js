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
 * 3. Augment the loaded schema with missing common fields (images, billing, entitlements, password reset).
 *
 * This file must stay ESM because the rest of src/ imports it as:
 *    import User from '../models/User.js'
 */

import path from 'node:path';
import { createRequire } from 'node:module';
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
  } catch (err) {
    // Keep this quiet-ish, but show the path so we know what was tried
    // console.log(`[UserModel] Not found at ${absPath}: ${err?.message || err}`);
    return null;
  }
}

// We normalize base dirs so we cover Windows + project-root runs
const PROJECT_ROOT = process.cwd();
const THIS_DIR = path.dirname(new URL(import.meta.url).pathname);

// --- REPLACE START: expanded candidate list (look for both .cjs and .js) ---
const CANDIDATES = [
  // Most common in your project: server/models/User.cjs
  path.resolve(PROJECT_ROOT, 'server/models/User.cjs'),
  path.resolve(PROJECT_ROOT, 'server/models/User.js'),
  // Also allow just models/ at project root
  path.resolve(PROJECT_ROOT, 'models/User.cjs'),
  path.resolve(PROJECT_ROOT, 'models/User.js'),
  // Relative to this ESM file (server/src/models/User.js → ../../models/User.cjs|.js)
  path.resolve(THIS_DIR, '../../models/User.cjs'),
  path.resolve(THIS_DIR, '../../models/User.js'),
];
// --- REPLACE END ---

let LoadedUser = null;

// Try all candidates in order
for (const candidate of CANDIDATES) {
  LoadedUser = tryLoadCJS(candidate);
  if (LoadedUser) break;
}

if (!LoadedUser) {
  console.warn('[UserModel] External model not found/readable. Defining a fallback schema in server/src/models/User.js');

  const { Schema, models, model } = mongoose;

  const featuresShape = {
    seeLikedYou:       { type: Boolean, default: false },
    superLikesPerWeek: { type: Number,  default: 0 },
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
      stripeCustomerId: { type: String, index: true, sparse: true, default: undefined },
      subscriptionId:   { type: String, default: null },

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
      hidden:       { type: Boolean, default: false },
      isHidden:     { type: Boolean, default: false },
      hiddenUntil:  { type: Date, default: undefined },
      resumeOnLogin:{ type: Boolean, default: false },
      visibility: {
        isHidden:      { type: Boolean, default: false },
        hiddenUntil:   { type: Date, default: undefined },
        resumeOnLogin: { type: Boolean, default: false },
      },
    },
    {
      strict: false,
      timestamps: true,
    }
  );

  LoadedUser = models.User || model('User', FallbackUserSchema);
} else {
  // --- REPLACE START: augment loaded schema with password reset & media if missing ---
  try {
    const s = LoadedUser?.schema;
    const { Schema } = mongoose;
    if (s) {
      const additions = {};

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

      if (Object.keys(additions).length) {
        s.add(additions);
        console.warn('[UserModel] Schema augmented with:', Object.keys(additions).sort().join(', '));
      }
    }
  } catch (e) {
    console.warn('[UserModel] Schema augmentation skipped:', e?.message || e);
  }
  // --- REPLACE END ---
}

const User = LoadedUser;
export default User;
export { User };
// --- REPLACE END ---
