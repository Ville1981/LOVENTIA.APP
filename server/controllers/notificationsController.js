// File: server/controllers/notificationsController.js

// --- REPLACE START: Notifications controller (ESM, safe, with internal create helper) ---
import mongoose from "mongoose";

// Tolerant model import (works whether Notification.js exports default or named)
import * as NotificationModule from "../models/Notification.js";
const Notification = NotificationModule?.default || NotificationModule;

// Small util: pick first defined
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

/**
 * Extract authenticated user id from various auth middlewares.
 * Accepts shapes like:
 *   req.user = { id } OR { userId } OR { _id } OR full JWT payload
 */
function getAuthUserId(req) {
  const u = req?.user || {};
  const id =
    pickFirstDefined(u.id, u.userId, u._id, req?.auth?.id, req?.auth?.userId) ??
    req?.userId ??
    req?.params?.userId;
  return id ? String(id) : null;
}

/**
 * GET /api/notifications
 * Query:
 *   - unread=1 (optional) → only unread notifications
 *   - limit (optional, default 50, max 200)
 *   - before (optional ISO date) → pagination by createdAt (lt)
 *   - sinceId (optional ObjectId) → only newer than a particular id
 *
 * Returns the current user's notifications sorted by newest first.
 */
export async function listMy(req, res) {
  try {
    const me = getAuthUserId(req);
    if (!me || !mongoose.Types.ObjectId.isValid(me)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const onlyUnread = String(req.query?.unread || "") === "1";
    const beforeIso = req.query?.before;
    const sinceId = req.query?.sinceId;
    const rawLimit = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 200))
      : 50;

    const q = { toUser: me };
    if (onlyUnread) q.read = false;

    // Time-based pagination (createdAt < before)
    if (beforeIso) {
      const d = new Date(beforeIso);
      if (!isNaN(+d)) q.createdAt = { ...(q.createdAt || {}), $lt: d };
    }

    // Newer-than pagination by _id if provided (ObjectId is time-sortable)
    if (sinceId && mongoose.Types.ObjectId.isValid(String(sinceId))) {
      q._id = { ...(q._id || {}), $gt: new mongoose.Types.ObjectId(String(sinceId)) };
    }

    const docs = await Notification.find(q)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate([
        { path: "fromUser", select: "username profilePicture" },
        { path: "toUser", select: "_id" },
      ])
      .lean({ virtuals: true });

    // Unread count snapshot for UI badge
    const unreadCount = await Notification.countDocuments({ toUser: me, read: false });

    return res.json({ notifications: docs, unreadCount });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notifications:listMy] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read (id must belong to the caller).
 */
export async function markRead(req, res) {
  try {
    const me = getAuthUserId(req);
    if (!me || !mongoose.Types.ObjectId.isValid(me)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = String(req.params?.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification id" });
    }

    const doc = await Notification.findOneAndUpdate(
      { _id: id, toUser: me },
      { $set: { read: true } },
      { new: true }
    )
      .populate([{ path: "fromUser", select: "username profilePicture" }])
      .lean({ virtuals: true });

    if (!doc) return res.status(404).json({ error: "Notification not found" });

    // Return remaining unread count for quick UI badge update
    const unreadCount = await Notification.countDocuments({ toUser: me, read: false });

    return res.json({ notification: doc, unreadCount });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notifications:markRead] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update notification" });
  }
}

/**
 * Internal helper (not an Express route):
 * create({ toUser, fromUser?, type, message? })
 *
 * - Validates minimal fields
 * - Silently returns null if input invalid (so callers can "fire-and-forget")
 * - Returns saved Notification document (lean object)
 */
export async function create(data = {}) {
  try {
    const toUser = data?.toUser ? String(data.toUser) : null;
    if (!toUser || !mongoose.Types.ObjectId.isValid(toUser)) return null;

    const payload = {
      toUser,
      type: String(data?.type || "generic"),
      read: false,
    };

    if (data?.fromUser && mongoose.Types.ObjectId.isValid(String(data.fromUser))) {
      payload.fromUser = String(data.fromUser);
    }
    if (data?.message) payload.message = String(data.message);

    const doc = await Notification.create(payload);
    // Return a lean object with minimal populate
    const saved = await Notification.findById(doc._id)
      .populate([{ path: "fromUser", select: "username profilePicture" }])
      .lean({ virtuals: true });

    return saved;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notifications:create] error:", err?.message || err);
    return null; // swallow in internal helper to avoid breaking caller flows
  }
}

// Default export keeps a familiar shape for route modules
export default {
  listMy,
  markRead,
  create,
};
// --- REPLACE END ---
