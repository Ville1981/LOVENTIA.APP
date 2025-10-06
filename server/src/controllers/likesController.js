// File: server/src/controllers/likesController.js

// --- REPLACE START: robust shim + wrappers for likes controller (ESM, alias-safe) ---
/**
 * Purpose:
 *  - Provide a stable ESM controller under `src/controllers/*` that proxies to the
 *    project root controller at `../../controllers/likesController.js`.
 *  - Expose BOTH naming styles used across the codebase:
 *      * likeUser, unlikeUser
 *      * listOutgoingLikes / listIncomingLikes / listMatches
 *      * getOutgoing / getIncoming / getMatches
 *  - Add light input validation for ObjectId format when calling like/unlike
 *    (prevents 200 on obviously invalid ids and avoids noisy logs).
 *
 * Notes:
 *  - We only add minimal logic here (format checks). Actual DB logic lives in
 *    the root controller to avoid duplication.
 *  - If a function is missing in the root controller, we respond with 501 to
 *    make the failure explicit.
 */

import mongoose from "mongoose";

// Lazy-load the root controller (ESM/CJS compatible)
let _rootCtrl = null;
async function getRootCtrl() {
  if (_rootCtrl) return _rootCtrl;

  // Try ESM first
  try {
    const mod = await import("../../controllers/likesController.js");
    _rootCtrl = mod?.default ? mod.default : mod;
    return _rootCtrl;
  } catch (e) {
    // Best effort CJS fallback (should rarely be needed in src/)
    try {
      // eslint-disable-next-line n/no-missing-require, import/no-commonjs, global-require
      const cjs = require("../../controllers/likesController.js"); // Node will error in pure ESM if unavailable
      _rootCtrl = cjs?.default ? cjs.default : cjs;
      return _rootCtrl;
    } catch (e2) {
      // Keep null; caller will handle 501
    }
  }
  return _rootCtrl;
}

// Small helper: 24-hex ObjectId format check (does not assert existence)
function isValidObjectId(id) {
  // Prefer Mongoose validation when available
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  // Fallback: strict 24-hex
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

// ──────────────────────────────────────────────────────────────────────────────
// Wrappers with minimal validation (forward to root implementation if present)
// ──────────────────────────────────────────────────────────────────────────────

export async function likeUser(req, res) {
  try {
    const targetId = req?.params?.targetId || req?.params?.id;
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const ctrl = await getRootCtrl();
    const impl = ctrl?.likeUser || ctrl?.like || ctrl?.createLike;
    if (typeof impl === "function") {
      return impl(req, res);
    }
    return res.status(501).json({ ok: false, error: "likesController.likeUser not available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}

export async function unlikeUser(req, res) {
  try {
    const targetId = req?.params?.targetId || req?.params?.id;
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const ctrl = await getRootCtrl();
    const impl = ctrl?.unlikeUser || ctrl?.unlike || ctrl?.removeLike;
    if (typeof impl === "function") {
      return impl(req, res);
    }
    return res.status(501).json({ ok: false, error: "likesController.unlikeUser not available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}

// List: Outgoing
export async function listOutgoingLikes(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl =
      ctrl?.listOutgoingLikes || ctrl?.getOutgoing || ctrl?.outgoing || ctrl?.listOutgoing;
    if (typeof impl === "function") {
      return impl(req, res);
    }
    return res.status(501).json({ ok: false, error: "likesController.listOutgoingLikes not available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}

// List: Incoming
export async function listIncomingLikes(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl =
      ctrl?.listIncomingLikes || ctrl?.getIncoming || ctrl?.incoming || ctrl?.listIncoming;
    if (typeof impl === "function") {
      return impl(req, res);
    }
    return res.status(501).json({ ok: false, error: "likesController.listIncomingLikes not available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}

// List: Matches
export async function listMatches(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl = ctrl?.listMatches || ctrl?.getMatches || ctrl?.matches;
    if (typeof impl === "function") {
      return impl(req, res);
    }
    return res.status(501).json({ ok: false, error: "likesController.listMatches not available" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Backward-compat named exports (aliases) so older imports keep working
// ──────────────────────────────────────────────────────────────────────────────
export const getOutgoing = listOutgoingLikes;
export const getIncoming = listIncomingLikes;
export const getMatches  = listMatches;

// Default export object (for routers that do `import ctrl from ...`)
const defaultExport = {
  likeUser,
  unlikeUser,
  // New names
  listOutgoingLikes,
  listIncomingLikes,
  listMatches,
  // Legacy aliases
  getOutgoing,
  getIncoming,
  getMatches,
};

export default defaultExport;

// Optional CJS interop (safe no-op in pure ESM)
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











