// --- REPLACE START: robust likes controller with idempotency + daily quota (Helsinki) ---
// -------------------------------------------------------------------------------------------------
// Likes Controller (ESM)
// -------------------------------------------------------------------------------------------------
// Purpose:
//  - Provide a stable likes controller with **idempotent** like/unlike and a **daily quota** for free users.
//  - Preserve backward compatibility with legacy names (getOutgoing/getIncoming/getMatches).
//  - Keep logic self-contained and router-safe; low coupling to Mongoose models.
//  - Centralize day/time helpers via ../utils/dayKey.js but keep local wrappers for stability.
//
// What this implements (fully working):
//  - POST /likes/:id (or :targetId)    → likeUser
//       Response shapes:
//         * 201 { ok:true, newLike:true,  remaining:<number|null>, resetAt:<ISO>, limit:<number|null>, timeZone:"Europe/Helsinki" }
//         * 200 { ok:true, newLike:false, remaining:<number|null>, resetAt:<ISO>, limit:<number|null>, timeZone:"Europe/Helsinki" }
//         * 429 { ok:false, code:"LIKE_QUOTA_EXCEEDED", remaining:0, resetAt:<ISO> }
//         * 404 { ok:false, error:"Target user not found" }
//         * 400 { ok:false, error:"Invalid user id format" | "You cannot like yourself" }
//         * 401 { ok:false, error:"Unauthorized" }
//  - DELETE /likes/:id (or :targetId)  → unlikeUser
//       Response shape:
//         * 200 { ok:true, unliked:true|false }
//
// Optional list endpoints (proxied if root controller exists):
//  - listOutgoingLikes / listIncomingLikes / listMatches
//    → Still proxied to a root controller if present, otherwise 501 (explicit).
//
// Notes:
//  - Data shape is minimal to avoid schema coupling:
//      * Likes are stored in a plain "likes" collection (upsert ensures idempotency).
//      * User quota counters kept in "users" collection:
//            stats.likesDay   (string "YYYY-MM-DD" in Europe/Helsinki)
//            stats.likesCount (number)
//  - Daily quota: 30/day for non-premium users; premium users are not limited.
//  - Timezone: Europe/Helsinki (day boundary + resetAt).
//
// Code style:
//  - All comments in English.
//  - Keep local helper wrappers to avoid breaking imports and keep file length stable.
//  - Avoid unnecessary shortening; only make required improvements.
//
// -------------------------------------------------------------------------------------------------

import mongoose from "mongoose";
import {
  dayKey as _dayKey,
  nextMidnightISO as _nextMidnightISO,
  is24Hex as _is24Hex,
} from "../utils/dayKey.js";

// -------------------------------------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------------------------------------
const DAILY_LIMIT_FREE = 30;
const TZ = "Europe/Helsinki";

// -------------------------------------------------------------------------------------------------
/**
 * Local helper wrappers (for stability).
 * We keep these so the file shape and internal call sites remain unchanged.
 * Internally they delegate to ../utils/dayKey.js.
 */
// -------------------------------------------------------------------------------------------------

/** Validate 24-hex ObjectId string (format-only). */
function isValidObjectId(id) {
  // Prefer mongoose validation if available, fallback to 24-hex
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return _is24Hex(id);
}

/** Return YYYY-MM-DD for the given instant in Europe/Helsinki. */
function helsinkiDayKey(d = new Date()) {
  return _dayKey(d, TZ);
}

/** Return ISO instant for next midnight in Europe/Helsinki. */
function nextMidnightHelsinkiISO(now = new Date()) {
  return _nextMidnightISO(now, TZ);
}

/** Resolve authenticated user id from various middlewares. */
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
// Low-level collection access (loose coupling to model files)
// -------------------------------------------------------------------------------------------------
function usersCollection() {
  return mongoose.connection.collection("users");
}
function likesCollection() {
  return mongoose.connection.collection("likes");
}

/** Ensure unique index on (userId, targetId) for idempotent likes. */
async function ensureLikesIndex() {
  try {
    const coll = likesCollection();
    await coll.createIndex(
      { userId: 1, targetId: 1 },
      { unique: true, name: "uniq_user_target" }
    );
  } catch {
    // benign if it already exists or if a race happened
  }
}

// -------------------------------------------------------------------------------------------------
// Controller: likeUser
//  - Idempotent creation of a like relation
//  - Enforces daily quota for FREE users
//  - Premium users bypass quota entirely
// -------------------------------------------------------------------------------------------------
export async function likeUser(req, res) {
  try {
    // Accept :targetId or :id from route
    const targetId = req?.params?.targetId || req?.params?.id;
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    if (String(authUserId) === String(targetId)) {
      return res.status(400).json({ ok: false, error: "You cannot like yourself" });
    }

    const Users = usersCollection();
    const Likes = likesCollection();
    await ensureLikesIndex();

    const userObjId = new mongoose.Types.ObjectId(authUserId);
    const targetObjId = new mongoose.Types.ObjectId(targetId);

    // 1) Validate target existence (fast projection)
    const target = await Users.findOne({ _id: targetObjId }, { projection: { _id: 1 } });
    if (!target) {
      return res.status(404).json({ ok: false, error: "Target user not found" });
    }

    // 2) Load current user flags relevant for premium/quota
    const me = await Users.findOne(
      { _id: userObjId },
      { projection: { isPremium: 1, premium: 1, entitlements: 1, stats: 1 } }
    );

    const isPremium =
      !!me?.isPremium ||
      !!me?.premium ||
      !!me?.entitlements?.features?.unlimitedLikes ||
      !!me?.entitlements?.features?.noAds ||
      false;

    // Daily keys (computed even for premium so UI can consistently show resetAt)
    const today = helsinkiDayKey();
    const resetAt = nextMidnightHelsinkiISO();

    // 3) Idempotent upsert of like relation
    //    - New like  → upsertedCount = 1  → newLike=true
    //    - Existing  → upsertedCount = 0  → newLike=false
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

    // 4) Load or init counters (FREE users only)
    let likesDay = me?.stats?.likesDay || null;
    let likesCount =
      typeof me?.stats?.likesCount === "number" ? me.stats.likesCount : 0;

    if (!isPremium) {
      // Reset window on day rollover
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

    // 5) Enforce quota (FREE only) but only for *new* likes
    if (!isPremium && newLike) {
      if (likesCount >= DAILY_LIMIT_FREE) {
        // Roll back the inserted like to keep DB consistent
        await Likes.deleteOne({ userId: userObjId, targetId: targetObjId }).catch(() => {});
        return res
          .status(429)
          .json({ ok: false, code: "LIKE_QUOTA_EXCEEDED", remaining: 0, resetAt });
      }
    }

    // 6) If we actually created a new like and user is FREE → increment counters
    if (!isPremium && newLike) {
      likesCount += 1;
      await Users.updateOne(
        { _id: userObjId },
        { $set: { "stats.likesDay": today, "stats.likesCount": likesCount } }
      );
    }

    // 7) Compute remaining for response (FREE only). For premium, use null.
    const remaining = isPremium ? null : Math.max(DAILY_LIMIT_FREE - likesCount, 0);
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
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

// -------------------------------------------------------------------------------------------------
// Controller: unlikeUser
//  - Removes like relation if it exists (idempotent; does not restore quota)
// -------------------------------------------------------------------------------------------------
export async function unlikeUser(req, res) {
  try {
    const targetId = req?.params?.targetId || req?.params?.id;
    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const Likes = likesCollection();
    const result = await Likes.deleteOne({
      userId: new mongoose.Types.ObjectId(authUserId),
      targetId: new mongoose.Types.ObjectId(targetId),
    });

    return res.status(200).json({ ok: true, unliked: result?.deletedCount > 0 });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

// -------------------------------------------------------------------------------------------------
// Optional list endpoints
//  - We try to proxy into a root controller (../../controllers/likesController.js) if it exists.
//  - If not, we return 501 to make missing coverage explicit.
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
    return res
      .status(501)
      .json({ ok: false, error: "likesController.listOutgoingLikes not available" });
  } catch (err) {
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
    return res
      .status(501)
      .json({ ok: false, error: "likesController.listIncomingLikes not available" });
  } catch (err) {
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
    return res
      .status(501)
      .json({ ok: false, error: "likesController.listMatches not available" });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

// -------------------------------------------------------------------------------------------------
// Backward-compat named exports (aliases)
// -------------------------------------------------------------------------------------------------
export const getOutgoing = listOutgoingLikes;
export const getIncoming = listIncomingLikes;
export const getMatches = listMatches;

// -------------------------------------------------------------------------------------------------
// Default export (for routers that do `import ctrl from ...`)
// -------------------------------------------------------------------------------------------------
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

// -------------------------------------------------------------------------------------------------
// Optional CJS interop (safe no-op in pure ESM)
// -------------------------------------------------------------------------------------------------
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
