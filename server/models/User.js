// server/models/User.js
// --- REPLACE START: ESM wrapper that default-exports the CommonJS User model ---
//
// Why this file exists:
// - Your project runs ESM ("type": "module" in package.json).
// - The *actual* Mongoose model implementation is in CommonJS at server/models/User.cjs
// - Many parts of the code import with:  import User from '../models/User.js'
//   This wrapper bridges ESM <-> CJS so both worlds keep working.
//
// What changed:
// - We now load the CJS model via createRequire() and export it as the ESM default.
// - We also provide a named export for convenience/consistency.
// - Added defensive checks and explicit error messages to simplify debugging.
//

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let LoadedUser;

// Try to load the CommonJS implementation
try {
  // Load the compiled/primary model implementation
  // NOTE: Do not change this path unless you actually move User.cjs
  // Keep the model logic in .cjs to avoid ESM/CJS mixing issues with Mongoose.
  // eslint-disable-next-line import/no-commonjs
  const maybeModule = require('./User.cjs');

  // Interop: in case someone wrapped it and exported as default
  LoadedUser = maybeModule && maybeModule.default ? maybeModule.default : maybeModule;

  if (typeof LoadedUser !== 'function') {
    throw new TypeError(
      '[models/User.js] Loaded User model is not a constructor/function. ' +
      'Ensure server/models/User.cjs exports the Mongoose model via module.exports = UserModel;'
    );
  }
} catch (err) {
  // Surface a very explicit error so the root cause is obvious in logs
  // (paths, CJS vs ESM, etc.)
  const details = (err && err.message) ? `\nOriginal error: ${err.message}` : '';
  throw new Error(
    '[models/User.js] Failed to load CommonJS model from ./User.cjs. ' +
    'This ESM wrapper requires the CJS file to exist and export the model via module.exports.' +
    details
  );
}

// ESM default export (what most of the app uses)
export default LoadedUser;

// Optional named exports for convenience in ESM land
export const User = LoadedUser;
export const UserModel = LoadedUser;

// --- REPLACE END ---
