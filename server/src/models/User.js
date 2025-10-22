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
// - ESM-safe import for the model: `import User from '../../src/models/User.js'`
// - If an external model exists, we use it. If not, we define a fallback schema.
// - We augment the schema with image & billing fields if they are missing:
//     profilePicture, profilePhoto, avatar, photos[], extraImages[],
//     stripeCustomerId, subscriptionId, isPremium, premium
//
// Replacement region markers let you diff future changes precisely.
//
// -----------------------------------------------------------------------------

import path from 'node:path';
import { pathToFileURL } from 'node:url';
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

async function tryLoadESM(absPath) {
  try {
    const href = pathToFileURL(absPath).href;
    const ns = await import(href);
    const mdl = pickModel(ns);
    return isModel(mdl) ? mdl : null;
  } catch {
    return null;
  }
}

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
const CANDIDATES = [
  // Root-level CJS/ESM
  path.resolve(process.cwd(), 'server/models/User.cjs'),
  path.resolve(process.cwd(), 'server/models/User.js'),
  path.resolve(process.cwd(), 'models/User.cjs'),
  path.resolve(process.cwd(), 'models/User.js'),
  // Legacy relative fallbacks (from server/src/models/User.js)
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../models/User.cjs'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../models/User.js'),
];

let LoadedUser = null;

// Try to resolve an existing model (prefer CJS require, then ESM)
for (const candidate of CANDIDATES) {
  // Try CJS first
  LoadedUser = tryLoadCJS(candidate);
  if (LoadedUser) {
    console.log(`[UserModel] Loaded from CJS: ${candidate}`);
    break;
  }
  // Try ESM next
  // eslint-disable-next-line no-await-in-loop
  LoadedUser = await tryLoadESM(candidate);
  if (LoadedUser) {
    console.log(`[UserModel] Loaded from ESM: ${candidate}`);
    break;
  }
}

// If still not found, define a minimal fallback schema/model
if (!LoadedUser) {
  console.warn('[UserModel] External model not found/readable. Defining a minimal fallback schema in server/src/models/User.js');

  const { Schema, models, model } = mongoose;

  // Keep this schema broad but non-breaking; it mirrors common fields used app-wide.
  const FallbackUserSchema = new Schema(
    {
      username: { type: String, index: true, sparse: true },
      email: { type: String, index: true, sparse: true },
      name: String,
      role: { type: String, default: 'user' },

      // Premium flags (keep both for compatibility)
      isPremium: { type: Boolean, default: false },
      premium: { type: Boolean, default: false }, // legacy alias kept in sync

      // Billing identifiers
      stripeCustomerId: { type: String, index: true, sparse: true, default: undefined },
      subscriptionId: { type: String, default: null },

      // Image-related fields (used by uploads/routes)
      profilePicture: { type: String, default: undefined },
      profilePhoto: { type: String, default: undefined },
      avatar: { type: String, default: undefined },
      photos: { type: [String], default: [] },
      extraImages: { type: [String], default: [] },

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

      // Entitlements (for premium features)
      entitlements: {
        features: { type: Map, of: Boolean },
      },
    },
    {
      strict: false, // do not break unknown fields from older DBs
      timestamps: true,
    }
  );

  // Create (or reuse) the model
  LoadedUser = models.User || model('User', FallbackUserSchema);
}

// Augment schema with required image/billing fields if the external model lacked them.
// Safe to call even when the model came from fallback above.
try {
  const s = LoadedUser?.schema;
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
    if (!s.path('subscriptionId')) {
      additions.subscriptionId = { type: String, default: null };
    }
    if (!s.path('isPremium')) {
      additions.isPremium = { type: Boolean, default: false };
    }
    if (!s.path('premium')) {
      additions.premium = { type: Boolean, default: false };
    }

    if (Object.keys(additions).length > 0) {
      s.add(additions);
      console.warn('[UserModel] Schema augmented with:', Object.keys(additions).sort().join(', '));
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

