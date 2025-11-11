// PATH: server/src/utils/normalizeUserOut.js

// --- REPLACE START: shim re-export for normalizeUserOut (lint-safe) ---
// This shim exists because some parts of the codebase import from "src/utils/normalizeUserOut.js",
// while the real implementation lives in "server/utils/normalizeUserOut.js".
// We re-export the default and all named exports from the real module without creating
// local identifiers, which keeps ESLint happy (avoids import/no-named-as-default).

export { default } from '../../utils/normalizeUserOut.js';
export {
  normalizeUserOut,
  normalizeUsersOut,
  toWebPath,
  asArray,
  cleanPathList,
  stripSensitive,
  ensureArrayFields,
  ensureCanonicalAvatar,
  ensureStringId,
  applyPremiumSafety,
  applyEntitlementsView,
} from '../../utils/normalizeUserOut.js';
// --- REPLACE END ---
