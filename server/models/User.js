// --- REPLACE START: ESM wrapper that default-exports the CommonJS User model ---
//
// Why this file exists:
// - Your project runs ESM ("type": "module" in package.json).
// - The *actual* Mongoose model implementation is in CommonJS at server/models/User.cjs
// - Many parts of the code import with:  import User from '../models/User.js'
//   This wrapper bridges ESM <-> CJS so both worlds keep working.
//
// What changed:
// - Load the CJS model via createRequire() and export it as the ESM default.
// - Provide named exports too.
// - Add defensive checks and explicit error messages to simplify debugging.
//

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let LoadedUser;

try {
  // Load the primary CommonJS model implementation
  // NOTE: keep this relative to the current file
  // eslint-disable-next-line import/no-commonjs
  const maybeModule = require('./User.cjs');

  // Interop: support both module.exports = Model and { default: Model }
  LoadedUser = (maybeModule && maybeModule.default) ? maybeModule.default : maybeModule;

  if (typeof LoadedUser !== 'function' && !LoadedUser?.prototype?.constructor?.name) {
    throw new TypeError(
      '[models/User.js] Loaded User model is not a constructor/function. ' +
      'Ensure server/models/User.cjs exports the Mongoose model via module.exports = UserModel;'
    );
  }
} catch (err) {
  const details = (err && err.message) ? `\nOriginal error: ${err.message}` : '';
  throw new Error(
    '[models/User.js] Failed to load CommonJS model from ./User.cjs. ' +
    'This ESM wrapper requires the CJS file to exist and export the model via module.exports.' +
    details
  );
}

// ESM default export (used across the app)
export default LoadedUser;

// Optional named exports for convenience
export const User = LoadedUser;
export const UserModel = LoadedUser;
// --- REPLACE END ---
