// File: server/controllers/likesController.js

// --- REPLACE START: Thin shim to main Likes controller (server/src/controllers/likesController.js) ---
"use strict";

/**
 * Thin shim for the main Likes controller.
 *
 * Purpose:
 *  - Avoid having multiple divergent implementations.
 *  - Make sure all routers that import from `server/controllers/likesController.js`
 *    actually use the real logic in `server/src/controllers/likesController.js`.
 */

import * as mainLikes from "../src/controllers/likesController.js";

// -----------------------------------------------------------------------------
// Named exports (directly forwarded, with safe fallbacks for legacy aliases)
// -----------------------------------------------------------------------------
export const likeUser =
  mainLikes.likeUser || mainLikes.default?.likeUser;

export const likeAndPush =
  mainLikes.likeAndPush ||
  mainLikes.default?.likeAndPush ||
  mainLikes.likeUser ||
  mainLikes.default?.likeUser;

export const unlikeUser =
  mainLikes.unlikeUser || mainLikes.default?.unlikeUser;

export const listOutgoingLikes =
  mainLikes.listOutgoingLikes ||
  mainLikes.getOutgoing ||
  mainLikes.default?.listOutgoingLikes ||
  mainLikes.default?.getOutgoing;

export const listIncomingLikes =
  mainLikes.listIncomingLikes ||
  mainLikes.getIncoming ||
  mainLikes.default?.listIncomingLikes ||
  mainLikes.default?.getIncoming;

export const listMatches =
  mainLikes.listMatches ||
  mainLikes.getMatches ||
  mainLikes.default?.listMatches ||
  mainLikes.default?.getMatches;

// Legacy alias names (some parts of the app may still use these)
export const getOutgoing = listOutgoingLikes;
export const getIncoming = listIncomingLikes;
export const getMatches = listMatches;

// -----------------------------------------------------------------------------
// Default export – for code that does `import likesController from ...`
// -----------------------------------------------------------------------------
const defaultExport = {
  likeUser,
  likeAndPush,
  unlikeUser,
  listOutgoingLikes,
  listIncomingLikes,
  listMatches,
  // legacy aliases
  getOutgoing,
  getIncoming,
  getMatches,
};

export default defaultExport;

// -----------------------------------------------------------------------------
// Optional CommonJS interop (safe no-op in pure ESM environments)
// -----------------------------------------------------------------------------
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== "undefined" && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = defaultExport;
  }
} catch {
  // no-op
}
// --- REPLACE END ---
