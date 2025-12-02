// File: server/__openapi_phase_pack/controllers/likesController.js

// --- REPLACE START: Thin shim that re-exports the main Likes controller ---
"use strict";

/**
 * Thin shim for the main Likes controller.
 *
 * Purpose:
 *  - Avoid keeping two separate implementations of the same logic.
 *  - Keep the OpenAPI phase-pack in sync with the real /api/likes behaviour.
 *
 * This file simply re-exports the handlers from the main controller:
 *   server/controllers/likesController.js
 */

import * as mainLikes from "../../controllers/likesController.js";

// -----------------------------------------------------------------------------
// Named exports with graceful fallbacks for legacy alias names
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

// Legacy aliases
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
