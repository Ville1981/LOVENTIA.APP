// PATH: server/src/controllers/likesController.js
// =================================================================================================
// Likes Controller (ESM)
// -------------------------------------------------------------------------------------------------
// Version: 1.3
//  - Idempotent like/unlike.
//  - Daily like quota for FREE users (Premium bypasses).
//  - ALWAYS push the latest swipe intent to rewind stack (even if like already existed).
//  - Exposes helper methods used by routes: likeAndPush, recordLikeForRewind, pushRewind.
//  - Keeps loose coupling to models (uses raw collections) and preserves legacy aliases.
//  - Block-aware: outgoing/incoming lists are filtered against the Block collection.
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
function blocksCollection() {
  return mongoose.connection.collection("blocks");
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
 * Compute a set of peer user ids that should be hidden for a given viewer
 * based on block relationships.
 *
 * We hide any user that is:
 *  - blocked BY the viewer (viewer is blocker)
 *  - OR has blocked the viewer (viewer is blocked)
 */
async function getBlockedPeerIds(rawAuthId) {
  const hidden = new Set();

  if (!isValidObjectId(rawAuthId)) return hidden;
  const viewerObjId = toObjectId(rawAuthId);
  if (!viewerObjId) return hidden;

  try {
    const Blocks = blocksCollection();
    const rows = await Blocks.find({
      $or: [{ blocker: viewerObjId }, { blocked: viewerObjId }],
    })
      .project({ blocker: 1, blocked: 1, _id: 0 })
      .toArray();

    for (const row of rows) {
      const blocker = row.blocker;
      const blocked = row.blocked;

      // If someone else blocked the viewer
      if (blocker && !blocker.equals(viewerObjId)) {
        hidden.add(String(blocker));
      }
      // If viewer blocked someone else
      if (blocked && !blocked.equals(viewerObjId)) {
        hidden.add(String(blocked));
      }
    }
  } catch (e) {
    logLikesDebug("getBlockedPeerIds:", e?.message || e);
  }

  return hidden;
}

/**
 * Filter a standard likes payload { ok, count, users[] } against blocked peers.
 * This is used by outgoing/incoming list endpoints. The function is async
 * because it may need to query the Block collection.
 */
async function filterLikesPayloadForBlocks(rawAuthId, payload) {
  try {
    if (!payload || typeof payload !== "object") return payload;
    if (!Array.isArray(payload.users) || payload.users.length === 0) return payload;

    const hidden = await getBlockedPeerIds(rawAuthId);
    if (!hidden || hidden.size === 0) return payload;

    const filteredUsers = payload.users.filter((u) => {
      if (!u || u._id == null) return true;
      const idVal = u._id;
      const idStr =
        idVal && typeof idVal.toString === "function"
          ? idVal.toString()
          : String(idVal);
      return !hidden.has(idStr);
    });

    payload.users = filteredUsers;
    payload.count = Array.isArray(filteredUsers) ? filteredUsers.length : 0;

    return payload;
  } catch (e) {
    logLikesDebug("filterLikesPayloadForBlocks:", e?.message || e);
    return payload;
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
      req?.body?.id ||
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
// List endpoints implemented directly (no recursive root proxy)
// -------------------------------------------------------------------------------------------------

/**
 * Legacy-style outgoing likes list:
 *  - Finds all like-documents where current user is the liker.
 *  - Hydrates target users.
 *  - Applies block-filtering on the final payload.
 */
export async function listOutgoingLikes(req, res) {
  try {
    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const userObjId = toObjectId(authUserId);
    if (!userObjId) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const Likes = likesCollection();
    const Users = usersCollection();

    // Find outgoing likes (limit helps avoid huge payloads; adjust if needed)
    const likeDocs = await Likes.find({ userId: userObjId })
      .project({ targetId: 1 })
      .limit(500)
      .toArray();

    const targetIds = likeDocs
      .map((d) => d?.targetId)
      .filter((id) => id && typeof id.equals === "function");

    if (targetIds.length === 0) {
      const emptyPayload = { ok: true, count: 0, users: [] };
      const filtered = await filterLikesPayloadForBlocks(authUserId, emptyPayload);
      return res.status(200).json(filtered);
    }

    // --- REPLACE START: remove email from likes list payloads ---
    // Security: never expose email in likes/matches list payloads.
    const users = await Users.find({ _id: { $in: targetIds } })
      .project({
        _id: 1,
        username: 1,
        age: 1,
        gender: 1,
        city: 1,
        country: 1,
        photos: 1,
      })
      .toArray();
    // --- REPLACE END ---

    const payload = {
      ok: true,
      count: users.length,
      users,
    };

    const filtered = await filterLikesPayloadForBlocks(authUserId, payload);
    return res.status(200).json(filtered);
  } catch (err) {
    logLikesDebug("listOutgoingLikes error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

/**
 * Legacy-style incoming likes list:
 *  - Finds likes where current user is the target.
 *  - Hydrates liker users.
 *  - Applies block-filtering.
 */
export async function listIncomingLikes(req, res) {
  try {
    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const userObjId = toObjectId(authUserId);
    if (!userObjId) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const Likes = likesCollection();
    const Users = usersCollection();

    const likeDocs = await Likes.find({ targetId: userObjId })
      .project({ userId: 1 })
      .limit(500)
      .toArray();

    const likerIds = likeDocs
      .map((d) => d?.userId)
      .filter((id) => id && typeof id.equals === "function");

    if (likerIds.length === 0) {
      const emptyPayload = { ok: true, count: 0, users: [] };
      const filtered = await filterLikesPayloadForBlocks(authUserId, emptyPayload);
      return res.status(200).json(filtered);
    }

    // --- REPLACE START: remove email from likes list payloads ---
    // Security: never expose email in likes/matches list payloads.
    const users = await Users.find({ _id: { $in: likerIds } })
      .project({
        _id: 1,
        username: 1,
        age: 1,
        gender: 1,
        city: 1,
        country: 1,
        photos: 1,
      })
      .toArray();
    // --- REPLACE END ---

    const payload = {
      ok: true,
      count: users.length,
      users,
    };

    const filtered = await filterLikesPayloadForBlocks(authUserId, payload);
    return res.status(200).json(filtered);
  } catch (err) {
    logLikesDebug("listIncomingLikes error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Internal error" });
  }
}

/**
 * listMatches:
 *  - A match = both users have liked each other.
 *  - We compute:
 *      outgoing targets (userId -> targetId),
 *      incoming likers (userId <- targetId),
 *    then intersect on peer user id.
 *  - Finally, hydrate matched peer user docs and apply block-filtering.
 */
export async function listMatches(req, res) {
  try {
    const authUserId = getAuthUserId(req);
    if (!isValidObjectId(authUserId)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const userObjId = toObjectId(authUserId);
    if (!userObjId) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const Likes = likesCollection();
    const Users = usersCollection();

    // Outgoing: users current user has liked
    const outgoingDocs = await Likes.find({ userId: userObjId })
      .project({ targetId: 1 })
      .limit(1000)
      .toArray();
    const outgoingSet = new Set(
      outgoingDocs
        .map((d) => d?.targetId)
        .filter((id) => id && typeof id.equals === "function")
        .map((id) => id.toString())
    );

    if (outgoingSet.size === 0) {
      const emptyPayload = { ok: true, count: 0, users: [] };
      const filtered = await filterLikesPayloadForBlocks(authUserId, emptyPayload);
      return res.status(200).json(filtered);
    }

    // Incoming: users who liked current user
    const incomingDocs = await Likes.find({ targetId: userObjId })
      .project({ userId: 1 })
      .limit(1000)
      .toArray();
    const incomingSet = new Set(
      incomingDocs
        .map((d) => d?.userId)
        .filter((id) => id && typeof id.equals === "function")
        .map((id) => id.toString())
    );

    const matchIds = [];
    for (const idStr of outgoingSet) {
      if (incomingSet.has(idStr)) {
        matchIds.push(toObjectId(idStr));
      }
    }

    if (matchIds.length === 0) {
      const emptyPayload = { ok: true, count: 0, users: [] };
      const filtered = await filterLikesPayloadForBlocks(authUserId, emptyPayload);
      return res.status(200).json(filtered);
    }

    // --- REPLACE START: remove email from likes list payloads ---
    // Security: never expose email in likes/matches list payloads.
    const users = await Users.find({ _id: { $in: matchIds } })
      .project({
        _id: 1,
        username: 1,
        age: 1,
        gender: 1,
        city: 1,
        country: 1,
        photos: 1,
      })
      .toArray();
    // --- REPLACE END ---

    const payload = {
      ok: true,
      count: users.length,
      users,
    };

    const filtered = await filterLikesPayloadForBlocks(authUserId, payload);
    return res.status(200).json(filtered);
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