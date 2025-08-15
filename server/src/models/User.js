// --- REPLACE START: ESM wrapper that default-exports the CommonJS User model ---
/**
 * ESM <-> CJS bridge for the User model.
 * This file runs in ESM mode ("type": "module" in package.json), but our primary
 * Mongoose model implementation lives in CommonJS at: server/models/User.cjs
 *
 * Any import like:
 *   import User from '../../src/models/User.js'
 * or:
 *   import { User } from '../../src/models/User.js'
 * will work after this replacement.
 *
 * Extra:
 * - Falls back to trying an ESM model at ../../models/User.js if the CJS file is missing.
 * - Dev-time sanity check warns if the schema does not include `politicalIdeology`.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let LoadedUser;

function isModel(maybe) {
  return !!maybe && (typeof maybe === 'function' || typeof maybe?.modelName === 'string');
}

try {
  // Primary: load the CommonJS model from the root /server/models directory
  // NOTE: path is relative to THIS FILE (server/src/models/User.js)
  //       ../../models/User.cjs -> server/models/User.cjs
  // eslint-disable-next-line import/no-commonjs, global-require
  const maybeModule = require('../../models/User.cjs');

  // Interop: support either module.exports = Model OR module.exports = { default: Model }
  LoadedUser = (maybeModule && maybeModule.default) ? maybeModule.default : maybeModule;

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
    console.warn('[server/src/models/User.js] CJS model not found or invalid, trying ESM fallback ../../models/User.js');
    const esm = await import('../../models/User.js');
    LoadedUser = esm.default || esm.User || esm.UserModel;
    if (!isModel(LoadedUser)) throw new Error('Fallback ESM export is not a valid model');
  } catch (fallbackErr) {
    const detailsA = primaryErr && primaryErr.message ? `\nPrimary error: ${primaryErr.message}` : '';
    const detailsB = fallbackErr && fallbackErr.message ? `\nFallback error: ${fallbackErr.message}` : '';
    throw new Error(
      '[server/src/models/User.js] Failed to load User model from ../../models/User.cjs ' +
      'and ESM fallback ../../models/User.js.\n' +
      'Expected export in User.cjs: module.exports = UserModel;' +
      detailsA + detailsB
    );
  }
}

// Dev-time sanity check: warn if the schema is missing critical fields we rely on.
// Do not throw in production; just warn so the app remains usable.
try {
  const hasSchema = !!LoadedUser?.schema;
  if (hasSchema) {
    const hasPoliticalIdeology = !!LoadedUser.schema.path('politicalIdeology');
    if (!hasPoliticalIdeology) {
      // eslint-disable-next-line no-console
      console.warn(
        '[server/src/models/User.js] Warning: User schema has no "politicalIdeology" path. ' +
        'Profile read/write may drop this value. Add it to server/models/User.cjs schema.'
      );
    }
  }
} catch {
  // ignore schema inspection errors
}

// Default + named exports for interop safety
export default LoadedUser;
export const User = LoadedUser;
export const UserModel = LoadedUser;
// --- REPLACE END ---
