// server/models/User.js

// --- REPLACE START: Hybrid loader — prefer ESM src model, fallback to CJS; keep exports stable ---
//
// Why this file exists:
// - Your project runs ESM ("type":"module") and many modules import:  import User from '../models/User.js'
// - Historically there is also a CJS model in server/models/User.cjs.
// - When that CJS file has parsing issues, the wrapper must not crash the app if an ESM model exists.
//
// What changed:
// - Try dynamic-import of ESM model at ../src/models/User.js first (preferred).
// - If that fails (e.g., src not present in a dist bundle), fallback to CJS via createRequire('./User.cjs').
// - Keep default and named exports consistent.
// - Add clear error diagnostics if both sources fail.
//
// Notes:
// - No behavioral changes to the model itself.
// - Comments are intentionally verbose to preserve maintainability and near line parity.
// - This replacement avoids shortening important context while removing duplication.
//

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** Resolve a usable model from either ESM src or CJS fallback. */
async function resolveUserModel() {
  // 1) Prefer ESM model from src (works best with your current codebase)
  try {
    // Use dynamic import to avoid loader conflicts if this file is also bundled
    const esm = await import('../src/models/User.js');
    const m = esm?.default || esm?.User || esm?.UserModel || esm;
    if (m && (typeof m === 'function' || (m.prototype && m.prototype.constructor))) {
      return m;
    }
    // If it loaded but wasn't a constructor, fall through to CJS
  } catch (e) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[models/User.js] ESM src model import failed, falling back to CJS:', e?.message || e);
    } catch { /* noop */ }
  }

  // 2) Fallback to legacy CommonJS model
  try {
    // eslint-disable-next-line import/no-commonjs
    const maybeModule = require('./User.cjs');

    // Interop: support both module.exports = Model and { default: Model }
    const cjs = (maybeModule && maybeModule.default) ? maybeModule.default : maybeModule;

    if (cjs && (typeof cjs === 'function' || (cjs.prototype && cjs.prototype.constructor))) {
      return cjs;
    }

    throw new TypeError(
      '[models/User.js] CJS fallback did not return a constructor. ' +
      'Ensure server/models/User.cjs exports the Mongoose model via module.exports = UserModel;'
    );
  } catch (err) {
    const details = (err && err.message) ? `\nOriginal error: ${err.message}` : '';
    throw new Error(
      '[models/User.js] Failed to resolve User model from BOTH ../src/models/User.js (ESM) and ./User.cjs (CJS).' +
      details
    );
  }
}

let LoadedUser;
let loadError;
try {
  LoadedUser = await resolveUserModel();
} catch (e) {
  loadError = e;
}

if (!LoadedUser) {
  // Re-throw with a clear message; this keeps previous error context
  throw (loadError ||
    new Error('[models/User.js] Could not load a valid User model from any source.'));
}

// ESM default export (used across the app)
export default LoadedUser;

// Optional named exports for convenience/interop
export const User = LoadedUser;
export const UserModel = LoadedUser;
// --- REPLACE END ---

