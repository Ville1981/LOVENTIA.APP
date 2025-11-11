// PATH: server/src/routes/rewind.js

// --- REPLACE START: ESM-compatible rewind route (Premium users have unlimited rewinds) ---
/* eslint-disable no-console */
/**
 * Rewind Router (ESM)
 * -----------------------------------------------------------------------------
 * POST /api/rewind
 *  - Premium-gated: requires unlimitedRewinds entitlement (or isPremium/premium).
 *  - Prefers the new rewind stack at: user.rewind.stack (newest first, index 0).
 *  - Graceful legacy fallback to user's arrays: likes / passes.
 *
 * Request body (JSON):
 *   {
 *     "scope": "likes" | "passes" | undefined
 *   }
 *
 * Responses:
 *   200 OK  { ok:true, source:'stack'|'likes'|'passes', targetUserId, message }
 *   400     { ok:false, error:'Nothing to rewind' | 'No entries in <scope> to rewind' }
 *   401     { ok:false, error:'Unauthorized' }
 *   403     { ok:false, error:'Premium required: unlimitedRewinds', code:'FEATURE_LOCKED', feature:'unlimitedRewinds' }
 *   500     { ok:false, error:'Internal Server Error' }
 *
 * Mount in app.js:
 *   import rewindRouter from "./routes/rewind.js";
 *   app.use("/api/rewind", rewindRouter);
 */

"use strict";

import express from "express";
import mongoose from "mongoose";

import authenticate from "../middleware/authenticate.js";
import User from "../models/User.js";

const router = express.Router();

// Ensure parsers (safe even if expressLoader already did these globally)
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Minimal debug logger (set DEBUG_REWIND=1 to enable). */
function dbg(...args) {
  if (process.env.DEBUG_REWIND === "1") {
    // eslint-disable-next-line no-console
    console.debug("[rewind]", ...args);
  }
}

/** Resolve a usable user id from common auth shapes. */
function getCurrentUserId(req) {
  return (
    req?.user?._id ||
    req?.user?.id ||
    req?.user?.userId ||
    req?.auth?.userId ||
    req?.auth?.id ||
    req?.userId ||
    null
  );
}

/**
 * Resolve the current User document.
 * Prefer hydrated req.user; otherwise fetch by id.
 * Dev fallback: Authorization: Bearer <ObjectId> directly.
 */
async function resolveCurrentUser(req) {
  const idFromUser = getCurrentUserId(req);
  if (idFromUser) {
    if (req.user && typeof req.user.save === "function") return req.user;
    try {
      return await User.findById(idFromUser).exec();
    } catch {
      /* ignore and continue to fallback */
    }
  }
  // Dev/test fallback: Authorization: Bearer <userId>
  try {
    const auth = String(req.headers.authorization || "");
    const [scheme, token] = auth.split(" ");
    if (scheme === "Bearer" && mongoose.isValidObjectId(token)) {
      return await User.findById(token).exec();
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Check Premium entitlement for unlimited rewinds.
 * Supports legacy booleans and structured entitlements.
 */
function hasUnlimitedRewinds(user) {
  if (!user) return false;
  if (user.isPremium === true || user.premium === true) return true;
  const feat = user?.entitlements?.features;
  if (feat && (feat.unlimitedRewinds === true || feat["unlimitedRewinds"] === true)) return true;
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;
  return false;
}

/** Choose legacy scope if stack is empty. */
function chooseLegacyScope(user, requestedScope) {
  const reqScope = (requestedScope || "").toLowerCase();
  if (reqScope === "likes" || reqScope === "passes") return reqScope;
  if (Array.isArray(user.likes) && user.likes.length > 0) return "likes";
  if (Array.isArray(user.passes) && user.passes.length > 0) return "passes";
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Route: POST /
 * ──────────────────────────────────────────────────────────────────────────── */

router.post("/", authenticate, async (req, res) => {
  try {
    const current = await resolveCurrentUser(req);
    if (!current) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // Enforce Premium entitlement server-side
    if (!hasUnlimitedRewinds(current)) {
      return res.status(403).json({
        ok: false,
        error: "Premium required: unlimitedRewinds",
        code: "FEATURE_LOCKED",
        feature: "unlimitedRewinds",
      });
    }

    // 1) Preferred: pop from new rewind stack (newest first at index 0)
    // Shape (historical variants supported):
    //   { type:'like', targetId:ObjectId, createdAt }
    //   { action:'like', target:ObjectId, at }
    //   { ..., targetUserId, ... } or { ..., target_id, ... }
    // --- REPLACE START: robust pop from stack, accept multiple shapes ---
    const stack = current?.rewind?.stack;
    if (Array.isArray(stack) && stack.length > 0) {
      // Remove the first element (newest)
      const [action] = stack.splice(0, 1);
      await current.save(); // persist stack mutation ONLY

      // Accept different historical shapes:
      const rawTarget =
        action?.targetId ??
        action?.target ??
        action?.targetUserId ??
        action?.target_id ??
        null;

      const targetId =
        rawTarget && mongoose.isValidObjectId(rawTarget)
          ? String(rawTarget)
          : typeof rawTarget === "string"
          ? rawTarget
          : null;

      return res.status(200).json({
        ok: true,
        source: "stack",
        targetUserId: targetId,
        action: action?.type || action?.action || "unknown",
        message: "Rewind from stack completed.",
      });
    }
    // --- REPLACE END ---

    // 2) Legacy fallback: likes/passes arrays
    const legacyScope = chooseLegacyScope(current, req.body && req.body.scope);
    if (!legacyScope) {
      return res.status(400).json({
        ok: false,
        error: "Nothing to rewind",
        detail: "Rewind stack is empty and neither likes nor passes contain any items.",
      });
    }

    if (!Array.isArray(current[legacyScope]) || current[legacyScope].length === 0) {
      return res.status(400).json({
        ok: false,
        error: `No entries in ${legacyScope} to rewind`,
      });
    }

    // Pop last entry from the chosen legacy array
    const targetUserId = current[legacyScope].pop();
    await current.save();

    dbg("legacy rewind:", { scope: legacyScope, targetUserId });

    return res.status(200).json({
      ok: true,
      source: legacyScope,
      targetUserId: String(targetUserId),
      message:
        legacyScope === "likes"
          ? "Last like has been undone (legacy array)."
          : "Last pass has been undone (legacy array).",
    });
  } catch (err) {
    console.error("[rewind] error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * Optional tiny debug endpoint (kept behind env flag, no docs; safe to keep)
 * ──────────────────────────────────────────────────────────────────────────── */
router.get("/debug", authenticate, async (req, res) => {
  if (process.env.ENABLE_REWIND_DEBUG !== "1") return res.status(404).end();
  const user = await resolveCurrentUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  return res.json({
    ok: true,
    hasUnlimitedRewinds: hasUnlimitedRewinds(user),
    stackCount: Array.isArray(user?.rewind?.stack) ? user.rewind.stack.length : 0,
    likesCount: Array.isArray(user?.likes) ? user.likes.length : 0,
    passesCount: Array.isArray(user?.passes) ? user.passes.length : 0,
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────────────────────────────────────── */

export default router;

// CJS interop for older loaders (no-op in pure ESM)
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== "undefined" && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = router;
  }
} catch {
  /* noop */
}
// --- REPLACE END ---


