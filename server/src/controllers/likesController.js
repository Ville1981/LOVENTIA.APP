// PATH: server/src/controllers/likesController.js
// --- REPLACE START: robust likes controller with idempotency + daily quota (Helsinki) ---
// =================================================================================================
// Likes Controller (ESM)
// -------------------------------------------------------------------------------------------------
// Version: 1.2
//  - Idempotent like/unlike.
//  - Daily like quota for FREE users (Premium bypasses).
//  - ALWAYS push the latest swipe intent to rewind stack (even if like already existed).
//  - Exposes helper methods used by routes: likeAndPush, recordLikeForRewind, pushRewind.
//  - Keeps loose coupling to models (uses raw collections) and preserves legacy aliases.
// Notes:
//  - Timezone boundaries use Europe/Helsinki.
//  - Responses keep stable shapes for the frontend.
//  - File is intentionally verbose (comments & helper wrappers) to keep diff length stable.
// =================================================================================================

import mongoose from "mongoose";

import {
  dayKey as _dayKey,
  nextMidnightISO as _nextMidnightISO,
  is24Hex as _is24Hex,
} from "../utils/dayKey.js";

// -------------------------------------------------------------------------------------------------
// Constants & tiny debug helper
// -------------------------------------------------------------------------------------------------
const DAILY_LIMIT_FREE = 30;
const TZ = "Europe/Helsinki";

/**
 * Debug logger for this module only (no-op unless env flag set).
 * Keeps log statements in code without noisy output by default.
 */
function logLikesDebug(...args) {
  if (process.env.DEBUG_LIKES === "1") {
    // eslint-disable-next-line no-console
    console.debug("[likes]", ...args);
  }
}

// -------------------------------------------------------------------------------------------------
// Local helpers (thin wrappers to keep call sites stable and explicit)
// -------------------------------------------------------------------------------------------------

/** Validate ObjectId string. Prefer Mongoose's validator, fallback to 24-hex. */
function isValidObjectId(id) {
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return _is24Hex(id);
}

/** Safe ObjectId creator (returns null when invalid). */
function toObjectId(id) {
  try {
    return isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
  } catch {
    return null;
  }
}

/** Return 'YYYY-MM-DD' for Europe/Helsinki. */
function helsinkiDayKey(d = new Date()) {
  return _dayKey(d, TZ);
}

/** Return ISO for next midnight (Europe/Helsinki). */
function nextMidnightHelsinkiISO(now = new Date()) {
  return _nextMidnightISO(now, TZ);
}

/** Extract authenticated user id from various middlewares. */
function getAuthUserId(req) {
  return (
    req?.user?.id ||
    req?.user?._id ||
    req?.auth?.userId ||
    req?.auth?.id ||
    req?.userId ||
    req?.uid ||
    null
  );
}

// -------------------------------------------------------------------------------------------------
// Raw collection access (avoid coupling to specific schema files)
// -------------------------------------------------------------------------------------------------
function usersCollection() {
  return mongoose.connection.collection("users");
}
function likesCollection() {
  return mongoose.connection.collection("likes");
}

/** Ensure unique index for idempotent likes (userId+targetId). */
async function ensureLikesIndex() {
  try {
    const coll = likesCollection();
    await coll.createIndex(
      { userId: 1, targetId: 1 },
      { unique: true, name: "uniq_user_target" }
    );
  } catch (e) {
    // Index may already exist or another process created it; non-fatal.
    logLikesDebug("ensureLikesIndex:", e?.message || e);
  }
}

/**
 * Push a rewind action to the user's stack.
 * We keep newest first ($position:0) so popping is O(1) at index 0.
 *
 * IMPORTANT: We write both shapes to be schema-agnostic:
 *  - New:   { type:'like', targetId:ObjectId, createdAt:Date }
 *  - Legacy:{ action:'like', target:ObjectId, at:Date }
 */
export async function pushRewindAction(userObjId, action) {
  try {
    const Users = usersCollection();

    const createdAt = action?.createdAt || action?.at || new Date();
    const type = action?.type || action?.action || "like";
    const targetId = action?.targetId || action?.target || null;

    const dual = {
      // modern
      type,
      targetId,
      createdAt,
      // legacy mirror
      action: type,
      target: targetId,
      at: createdAt,
    };

    const r = await Users.updateOne(
      { _id: userObjId },
      {
        $push: {
          "rewind.stack": {
            $each: [dual],
            $position: 0, // newest first
            $slice: -50, // cap to 50
          },
        },
        // Note: without upsert this acts as a no-op, left here to preserve intent.
        $setOnInsert: { "rewind.max": 50 },
      }
    );

    if (process.env.DEBUG_LIKES === "1") {
      logLikesDebug("pushRewindAction result:", {
        matched: r?.matchedCount,
        modified: r?.modifiedCount,
        acknowledged: r?.acknowledged,
      });
    }
  } catch (e) {
    logLikesDebug("pushRewindAction:", e?.message || e);
  }
}

/**
 * Controller-style helper so routes (or other controllers) can explicitly
 * record a like into the rewind stack using only the request + payload.
 * Shape is compatible with pushRewindBestEffort in routes.
 */
export async function recordLikeForRewind(req, payload = {}) {
  try {
    const authId = getAuthUserId(req);
    if (!isValidObjectId(authId)) return false;

    const userObjId = toObjectId(authId);
    const target =
      payload?.targetUserId ||
      payload?.targetId ||
      payload?.target ||
      req?.params?.targetId ||
      req?.body?.targetUserId ||
      req?.body?.targetId ||
      null;

    if (!isValidObjectId(target)) return false;

    await pushRewindAction(userObjId, {
      type: "like",
      targetId: toObjectId(target),
    });

    return true;
  } catch (e) {
    logLikesDebug("recordLikeForRewind:", e?.message || e);
    return false;
  }
}

/**
 * Alias kept for older code that might call likesController.pushRewind(...)
 * (internally just proxies to recordLikeForRewind).
 */
export async function pushRewind(req, payload) {
  return recordLikeForRewind(req, payload);
}

/** Mirror like to legacy users.likes array (best-effort). */
async function mirrorLikeAdd(userObjId, targetObjId) {
  try {
    await usersCollection().updateOne(
      { _id: userObjId },
      { $addToSet: { likes: targetObjId } }
    );
  } catch (e) {
    logLikesDebug("mirrorLikeAdd:", e?.message || e);
  }
}

/** Mirror unlike removal from legacy users.likes array (best-effort). */
async function mirrorLikeRemove(userObjId, targetObjId) {
  try {
    await usersCollection().updateOne(
      { _id: userObjId },
      { $pull: { likes: targetObjId } }
    );
  } catch (e) {
    logLikesDebug("mirrorLikeRemove:", e?.message || e);
  }
}

// -------------------------------------------------------------------------------------------------
// likeUser — idempotent like + free-tier daily quota + rewind push
// -------------------------------------------------------------------------------------------------
export async function likeUser(req, res) {
  try {
    // Accept :targetId or :id from route params and compatible body fields
    const rawTarget =
      req?.params?.targetId ||
      req?.params?.id ||
      req?.body?.targetUserId ||
      req?.body?.targetId ||
      req?.body?.id;

    if (!isValidObjectId(rawTarget)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const rawAuth = getAuthUserId(req);
    if (!isValidObjectId(rawAuth)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    if (String(rawAuth) === String(rawTarget)) {
      return res
        .status(400)
        .json({ ok: false, error: "You cannot like yourself" });
    }

    const userObjId = toObjectId(rawAuth);
    const targetObjId = toObjectId(rawTarget);
    if (!userObjId || !targetObjId) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const Users = usersCollection();
    const Likes = likesCollection();

    await ensureLikesIndex();

    // 1) Validate that the target user exists (fast projection)
    const target = await Users.findOne(
      { _id: targetObjId },
      { projection: { _id: 1 } }
    );
    if (!target) {
      return res.status(404).json({ ok: false, error: "Target user not found" });
    }

    // 2) Load premium/quota flags from the acting user
    const me = await Users.findOne(
      { _id: userObjId },
      {
        projection: {
          isPremium: 1,
          premium: 1,
          entitlements: 1,
          stats: 1,
        },
      }
    );

    const isPremium =
      !!me?.isPremium ||
      !!me?.premium ||
      !!me?.entitlements?.features?.unlimitedLikes ||
      !!me?.entitlements?.features?.noAds ||
      false;

    // Compute day/resetAt even for premium to keep response shape stable
    const today = helsinkiDayKey();
    const resetAt = nextMidnightHelsinkiISO();

    // 3) Upsert like (idempotent)
    const up = await Likes.updateOne(
      { userId: userObjId, targetId: targetObjId },
      {
        $setOnInsert: {
          userId: userObjId,
          targetId: targetObjId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    const newLike = !!up.upsertedCount;

    logLikesDebug("likeUser upsert:", {
      newLike,
      userId: String(userObjId),
      targetId: String(targetObjId),
    });

    // 4) Prepare quota counters (FREE only)
    let likesDay = me?.stats?.likesDay || null;
    let likesCount =
      typeof me?.stats?.likesCount === "number" ? me.stats.likesCount : 0;

    if (!isPremium) {
      if (likesDay !== today) {
        likesDay = today;
        likesCount = 0;
        await Users.updateOne(
          { _id: userObjId },
          { $set: { "stats.likesDay": today, "stats.likesCount": 0 } },
          { upsert: false }
        );
      }
    }

    // 5) Enforce daily limit only when a NEW like happens on FREE tier
    if (!isPremium && newLike && likesCount >= DAILY_LIMIT_FREE) {
      // Roll back inserted like to keep DB consistent
      await Likes.deleteOne({ userId: userObjId, targetId: targetObjId }).catch(
        () => {}
      );
      return res.status(429).json({
        ok: false,
        code: "LIKE_QUOTA_EXCEEDED",
        remaining: 0,
        resetAt,
      });
    }

    // --- REPLACE START: side-effects & quotas (always push to rewind stack) ---
    // 6) Side effects: mirror only when it's a brand-new like, but ALWAYS push rewind intent
    if (newLike) {
      // legacy array for older UIs
      await mirrorLikeAdd(userObjId, targetObjId);
    }

    // ✅ Always record the user's latest swipe intent to the rewind stack
    await pushRewindAction(userObjId, { type: "like", targetId: targetObjId });

    // 7) If FREE and new like → bump counters
    if (!isPremium && newLike) {
      likesCount += 1;
      await Users.updateOne(
        { _id: userObjId },
        { $set: { "stats.likesDay": today, "stats.likesCount": likesCount } }
      );
    }
    // --- REPLACE END ---

    // 8) Respond with stable shape
    const remaining = isPremium
      ? null
      : Math.max(DAILY_LIMIT_FREE - likesCount, 0);
    const status = newLike ? 201 : 200;

    return res.status(status).json({
      ok: true,
      newLike,
      remaining,
      resetAt,
      limit: isPremium ? null : DAILY_LIMIT_FREE,
      timeZone: TZ,
    });
  } catch (err) {
    logLikesDebug("likeUser error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

/**
 * likeAndPush — explicit wrapper used by routes when available.
 * Routes that call this will NOT attach their own rewind hook,
 * so this ensures we only push to rewind.stack once per like.
 */
export async function likeAndPush(req, res) {
  return likeUser(req, res);
}

// -------------------------------------------------------------------------------------------------
// unlikeUser — idempotent removal (+ mirror pull from users.likes)
// -------------------------------------------------------------------------------------------------
export async function unlikeUser(req, res) {
  try {
    const rawTarget = req?.params?.targetId || req?.params?.id;
    if (!isValidObjectId(rawTarget)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const rawAuth = getAuthUserId(req);
    if (!isValidObjectId(rawAuth)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const userObjId = toObjectId(rawAuth);
    const targetObjId = toObjectId(rawTarget);
    if (!userObjId || !targetObjId) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const Likes = likesCollection();

    const result = await Likes.deleteOne({
      userId: userObjId,
      targetId: targetObjId,
    });
    await mirrorLikeRemove(userObjId, targetObjId);

    return res
      .status(200)
      .json({ ok: true, unliked: result?.deletedCount > 0 });
  } catch (err) {
    logLikesDebug("unlikeUser error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

// -------------------------------------------------------------------------------------------------
// Optional list endpoints (proxy to root controller if available)
// -------------------------------------------------------------------------------------------------
let _rootCtrl = null;

async function getRootCtrl() {
  if (_rootCtrl) return _rootCtrl;
  try {
    const mod = await import("../../controllers/likesController.js");
    _rootCtrl = mod?.default ? mod.default : mod;
  } catch (e) {
    try {
      // eslint-disable-next-line n/no-missing-require, import/no-commonjs, global-require
      // @ts-ignore
      const cjs = require("../../controllers/likesController.js");
      _rootCtrl = cjs?.default ? cjs.default : cjs;
    } catch {
      _rootCtrl = null;
    }
  }
  return _rootCtrl;
}

export async function listOutgoingLikes(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl =
      ctrl?.listOutgoingLikes ||
      ctrl?.getOutgoing ||
      ctrl?.outgoing ||
      ctrl?.listOutgoing;
    if (typeof impl === "function") return impl(req, res);

    // Light fallback using mirrored ids; avoids heavy hydration
    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const me = await usersCollection().findOne(
      { _id: toObjectId(authUserId) },
      { projection: { likes: 1 } }
    );
    const ids = Array.isArray(me?.likes) ? me.likes : [];
    return res.status(200).json({ ok: true, count: ids.length, users: [] });
  } catch (err) {
    logLikesDebug("listOutgoingLikes error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

export async function listIncomingLikes(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl =
      ctrl?.listIncomingLikes ||
      ctrl?.getIncoming ||
      ctrl?.incoming ||
      ctrl?.listIncoming;
    if (typeof impl === "function") return impl(req, res);
    return res.status(501).json({
      ok: false,
      error: "likesController.listIncomingLikes not available",
    });
  } catch (err) {
    logLikesDebug("listIncomingLikes error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

export async function listMatches(req, res) {
  try {
    const ctrl = await getRootCtrl();
    const impl = ctrl?.listMatches || ctrl?.getMatches || ctrl?.matches;
    if (typeof impl === "function") return impl(req, res);
    return res.status(501).json({
      ok: false,
      error: "likesController.listMatches not available",
    });
  } catch (err) {
    logLikesDebug("listMatches error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

// -------------------------------------------------------------------------------------------------
// Backward-compat aliases & default export
// -------------------------------------------------------------------------------------------------
export const getOutgoing = listOutgoingLikes;
export const getIncoming = listIncomingLikes;
export const getMatches = listMatches;

const defaultExport = {
  likeUser,
  likeAndPush,
  unlikeUser,
  listOutgoingLikes,
  listIncomingLikes,
  listMatches,
  // rewind helpers
  pushRewindAction,
  recordLikeForRewind,
  pushRewind,
  // aliases
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

