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

    // Apply in one go if we added anything.
    if (Object.keys(additions).length > 0) {
      s.add(additions);
      // eslint-disable-next-line no-console
      console.warn(
        "[server/src/models/User.js] Schema augmented with missing image fields:",
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
