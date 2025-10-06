// File: server/src/controllers/userController.js

// --- REPLACE START: ESM shim that forwards to ../../controllers/userController.js (CJS/ESM safe) ---
/**
 * This shim bridges imports from "server/src/controllers/userController.js"
 * to the actual controller located at "server/controllers/userController.js".
 *
 * Why:
 * - Some modules import from the src/ path (ESM), while the real controller
 *   lives one level up without /src (often CommonJS).
 * - This shim keeps your imports stable and avoids duplicating logic.
 *
 * Behavior:
 * - Default-exports the upstream module's default if present, otherwise the module itself.
 * - Re-exports a set of named functions by reading them off the default export object,
 *   so it works whether the upstream is CJS (module.exports = { ... }) or ESM.
 * - All comments in English for consistency.
 */

import upstream from "../../controllers/userController.js";

// For CJS upstream, everything is usually on the default export object.
// For ESM upstream with named exports, bundlers typically expose them on the namespace.
// We normalize to a single object reference here.
const mod = upstream && upstream.default ? upstream.default : upstream;

// Default export (object with handlers)
export default mod;

// Named exports: bind through to keep compatibility for both CJS and ESM upstreams.
// If a function does not exist upstream, it will export as undefined (safe for optional imports).
export const registerUser = mod?.registerUser;
export const loginUser = mod?.loginUser;

export const forgotPassword = mod?.forgotPassword;
export const resetPassword = mod?.resetPassword;

export const getMe = mod?.getMe;
export const getProfile = mod?.getProfile;
export const updateProfile = mod?.updateProfile;

export const upgradeToPremium = mod?.upgradeToPremium;
export const getMatchesWithScore = mod?.getMatchesWithScore;

export const uploadExtraPhotos = mod?.uploadExtraPhotos;
export const uploadPhotoStep = mod?.uploadPhotoStep;
export const deletePhotoSlot = mod?.deletePhotoSlot;

export const deleteMeUser = mod?.deleteMeUser;

export const setVisibilityMe = mod?.setVisibilityMe;
export const hideMe = mod?.hideMe;
export const unhideMe = mod?.unhideMe;
// --- REPLACE END ---
