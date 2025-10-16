<<<<<<< HEAD
// File: server/src/models/User.js

// --- REPLACE START: ESM wrapper that default-exports the CommonJS User model and augments missing image fields ---
/**
 * ESM <-> CJS bridge for the User model, with schema augmentation for image fields.
 *
 * Why this file exists:
 * - The app runs ESM ("type": "module"), but the primary Mongoose model may be in CJS.
 * - Some deployments use a schema that’s missing image-related paths when `strict: true`,
 *   causing writes to drop silently. We defensively add those paths here if missing.
 *
 * What it guarantees:
 * - Importing via ESM works:
 *     import User from '../../src/models/User.js'
 *   or:
 *     import { User } from '../../src/models/User.js'
 * - The schema WILL HAVE the following fields (created if absent):
 *     profilePicture: String
 *     profilePhoto:   String
 *     avatar:         String
 *     photos:         [String]
 *     extraImages:    [String]
 *     stripeCustomerId: String (indexed, sparse)
 *
 * Fallbacks:
 * - First tries to load the CommonJS model at: ../../models/User.cjs
 * - If not found/invalid, tries an ESM model at: ../../models/User.js
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

let LoadedUser;

/** Small type-guard: Mongoose model constructors usually have modelName; also allow fn */
function isModel(maybe) {
  return !!maybe && (typeof maybe === "function" || typeof maybe?.modelName === "string");
}

try {
  // Primary: load the CommonJS model from the root /server/models directory
  // NOTE: path is relative to THIS FILE: server/src/models/User.js  ->  ../../models/User.cjs
  // eslint-disable-next-line import/no-commonjs, global-require
  const maybeModule = require("../../models/User.cjs");

  // Interop: support either module.exports = Model OR module.exports = { default: Model }
  LoadedUser = maybeModule && maybeModule.default ? maybeModule.default : maybeModule;

  if (!isModel(LoadedUser)) {
    throw new TypeError(
      '[server/src/models/User.js] Loaded module is not a Mongoose model constructor. ' +
        'Ensure server/models/User.cjs exports the model via "module.exports = UserModel".'
    );
  }
} catch (primaryErr) {
  // Optional fallback: try an ESM-exported model in ../../models/User.js
  try {
    // eslint-disable-next-line no-console
    console.warn(
      "[server/src/models/User.js] CJS model not found or invalid, trying ESM fallback ../../models/User.js"
    );
    const esm = await import("../../models/User.js");
    LoadedUser = esm.default || esm.User || esm.UserModel;
    if (!isModel(LoadedUser)) throw new Error("Fallback ESM export is not a valid model");
  } catch (fallbackErr) {
    const detailsA =
      primaryErr && primaryErr.message ? `\nPrimary error: ${primaryErr.message}` : "";
    const detailsB =
      fallbackErr && fallbackErr.message ? `\nFallback error: ${fallbackErr.message}` : "";
    throw new Error(
      "[server/src/models/User.js] Failed to load User model from ../../models/User.cjs " +
        "and ESM fallback ../../models/User.js.\n" +
        'Expected export in User.cjs: module.exports = UserModel;' +
        detailsA +
        detailsB
    );
  }
}

/**
 * Augment schema with required image fields if missing.
 * This is safe even when the underlying schema already defines them.
 * For arrays we set a default [] to avoid undefined checks in routes.
 * For strings we prefer `default: undefined` to avoid writing empty strings.
 */
try {
  const hasSchema = !!LoadedUser?.schema;
  if (hasSchema) {
    const s = LoadedUser.schema;

    // Prepare additions; only add what is missing to avoid duplicate path warnings.
    const additions = {};

    // Explicit image scalar fields
    if (!s.path("profilePicture")) additions.profilePicture = { type: String, default: undefined };
    if (!s.path("profilePhoto"))   additions.profilePhoto   = { type: String, default: undefined };
    if (!s.path("avatar"))         additions.avatar         = { type: String, default: undefined };

    // Explicit image arrays (must default to [])
    if (!s.path("photos"))       additions.photos       = { type: [String], default: [] };
    if (!s.path("extraImages"))  additions.extraImages  = { type: [String], default: [] };

    // Stripe customer id required for billing integration (indexed + sparse).
    if (!s.path("stripeCustomerId")) {
      additions.stripeCustomerId = {
        type: String,
        index: true,
        sparse: true,
        default: undefined
      };
    } else {
      // Ensure an index exists even if field already present without index options.
      // This is idempotent; Mongoose/MongoDB will handle duplicate index definitions gracefully.
      try {
        s.index({ stripeCustomerId: 1 }, { sparse: true, name: "idx_stripeCustomerId_sparse" });
      } catch {
        // no-op: index creation hints are best-effort here
      }
    }

    // Apply in one go if we added anything.
    if (Object.keys(additions).length > 0) {
      s.add(additions);
      // eslint-disable-next-line no-console
      console.warn(
        "[server/src/models/User.js] Schema augmented with missing fields:",
        Object.keys(additions).join(", ")
      );
    }

    // Dev-time sanity ping for other fields FE/BE rely on (non-fatal).
    if (!s.path("politicalIdeology")) {
      // eslint-disable-next-line no-console
      console.warn(
        '[server/src/models/User.js] Warning: schema has no "politicalIdeology". ' +
          "Profile read/write may drop this value if strict mode is on."
      );
    }
  }
} catch (schemaErr) {
  // eslint-disable-next-line no-console
  console.warn("[server/src/models/User.js] Schema augmentation skipped:", schemaErr?.message || schemaErr);
}

// Default + named exports for interop safety
export default LoadedUser;
export const User = LoadedUser;
export const UserModel = LoadedUser;
// --- REPLACE END ---

=======
// server/src/models/User.js
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
//     profilePicture, profilePhoto, avatar, photos[], extraImages[], stripeCustomerId
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
    const mod = require(absPath); // CJS
    const mdl = pickModel(mod);
    return isModel(mdl) ? mdl : null;
  } catch {
    return null;
  }
}

// Candidate locations (relative to this file: server/src/models/User.js)
const CANDIDATES = [
  // Root-level CJS/ESM
  path.resolve(process.cwd(), 'server/models/User.cjs'),
  path.resolve(process.cwd(), 'server/models/User.js'),
  path.resolve(process.cwd(), 'models/User.cjs'),
  path.resolve(process.cwd(), 'models/User.js'),
  // Legacy relative fallbacks
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
  // NOTE: We do ESM attempt only if CJS failed for this candidate.
  // Keep loop order deterministic.
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
      isPremium: { type: Boolean, default: false },

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

      // Billing
      stripeCustomerId: { type: String, index: true, sparse: true, default: undefined },
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

    if (!s.path('profilePicture')) additions.profilePicture = { type: String, default: undefined };
    if (!s.path('profilePhoto'))   additions.profilePhoto   = { type: String, default: undefined };
    if (!s.path('avatar'))         additions.avatar         = { type: String, default: undefined };
    if (!s.path('photos'))         additions.photos         = { type: [String], default: [] };
    if (!s.path('extraImages'))    additions.extraImages    = { type: [String], default: [] };

    if (!s.path('stripeCustomerId')) {
      additions.stripeCustomerId = { type: String, index: true, sparse: true, default: undefined };
    } else {
      try {
        s.index({ stripeCustomerId: 1 }, { sparse: true, name: 'idx_stripeCustomerId_sparse' });
      } catch {
        // best effort
      }
    }

    if (Object.keys(additions).length > 0) {
      s.add(additions);
      console.warn('[UserModel] Schema augmented with:', Object.keys(additions).join(', '));
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
















>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
