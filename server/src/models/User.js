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
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let LoadedUser;

try {
  // Load the CommonJS model from the root /server/models directory
  // NOTE: path is relative to THIS FILE (server/src/models/User.js)
  //       ../../models/User.cjs -> server/models/User.cjs
  // eslint-disable-next-line import/no-commonjs, global-require
  const maybeModule = require('../../models/User.cjs');

  // Interop: support either module.exports = Model OR module.exports = { default: Model }
  LoadedUser = (maybeModule && maybeModule.default) ? maybeModule.default : maybeModule;

  if (!LoadedUser || typeof LoadedUser !== 'function') {
    throw new TypeError(
      '[server/src/models/User.js] Loaded module is not a Mongoose model constructor. ' +
      'Ensure server/models/User.cjs exports the model via "module.exports = UserModel".'
    );
  }
} catch (err) {
  const details = err && err.message ? `\nOriginal error: ${err.message}` : '';
  throw new Error(
    '[server/src/models/User.js] Failed to load CommonJS model from ../../models/User.cjs.' +
    ' This ESM wrapper requires that file to exist.\n' +
    'Expected export in User.cjs: module.exports = UserModel;' +
    details
  );
}

// Default + named exports for interop safety
export default LoadedUser;
export const User = LoadedUser;
export const UserModel = LoadedUser;
// --- REPLACE END ---
