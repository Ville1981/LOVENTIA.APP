// PATH: server/src/controllers/blockController.js

// --- REPLACE START: Block controller (block / unblock / list) ---

import mongoose from "mongoose";
import Block from "../models/Block.js";
import User from "../models/User.js";

/**
 * Helper to get current authenticated user's id as string.
 */
function getCurrentUserId(req) {
  const user = req.user;
  if (!user) return null;

  // Support both id and _id on req.user
  const id = user.id || user._id;
  return id ? String(id) : null;
}

/**
 * Ensure we have a valid Mongo ObjectId.
 */
function isValidObjectId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));
}

/**
 * POST /api/block/:id
 * Creates (or keeps) a block from the current user to :id.
 */
export async function blockUser(req, res, next) {
  try {
    const blockerId = getCurrentUserId(req);
    const targetId = req.params.id;

    if (!blockerId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid target user id" });
    }

    if (String(blockerId) === String(targetId)) {
      return res
        .status(400)
        .json({ ok: false, error: "You cannot block yourself" });
    }

    // Optional reason from body
    const { reason } = req.body || {};

    // Ensure target user exists (defensive)
    const targetUser = await User.findById(targetId).select("_id");
    if (!targetUser) {
      return res.status(404).json({ ok: false, error: "Target user not found" });
    }

    const update = {
      blocker: blockerId,
      blocked: targetId,
    };

    if (typeof reason === "string" && reason.trim().length > 0) {
      update.reason = reason.trim().slice(0, 500);
    }

    const doc = await Block.findOneAndUpdate(
      { blocker: blockerId, blocked: targetId },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      ok: true,
      block: {
        id: String(doc._id),
        blocker: String(doc.blocker),
        blocked: String(doc.blocked),
        reason: doc.reason || null,
        createdAt: doc.createdAt || null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("blockUser error:", err);
    return next(err);
  }
}

/**
 * DELETE /api/block/:id
 * Removes a block (if it exists) from current user to :id.
 */
export async function unblockUser(req, res, next) {
  try {
    const blockerId = getCurrentUserId(req);
    const targetId = req.params.id;

    if (!blockerId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ ok: false, error: "Invalid target user id" });
    }

    const result = await Block.deleteOne({
      blocker: blockerId,
      blocked: targetId,
    });

    return res.status(200).json({
      ok: true,
      removed: result.deletedCount > 0,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("unblockUser error:", err);
    return next(err);
  }
}

/**
 * GET /api/block
 * Returns a list of users that the current user has blocked.
 */
export async function getBlockedUsers(req, res, next) {
  try {
    const blockerId = getCurrentUserId(req);

    if (!blockerId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const docs = await Block.find({ blocker: blockerId })
      .sort({ createdAt: -1 })
      .populate({ path: "blocked", select: "username name email profilePicture" })
      .lean();

    const items = docs.map((doc) => ({
      id: String(doc._id),
      blocker: String(doc.blocker),
      blockedUserId: doc.blocked ? String(doc.blocked._id) : String(doc.blocked),
      blockedUser: doc.blocked
        ? {
            id: String(doc.blocked._id),
            username: doc.blocked.username || null,
            name: doc.blocked.name || null,
            email: doc.blocked.email || null,
            profilePicture: doc.blocked.profilePicture || null,
          }
        : null,
      reason: doc.reason || null,
      createdAt: doc.createdAt || null,
    }));

    return res.status(200).json({
      ok: true,
      count: items.length,
      items,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("getBlockedUsers error:", err);
    return next(err);
  }
}

// --- REPLACE END ---
