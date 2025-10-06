// File: server/src/controllers/messagesController.js

// --- REPLACE START: Messages controller (ESM, safe, mirrors router logic) ---
"use strict";

import mongoose from "mongoose";
import Message from "../models/Message.js";

/**
 * Premium / entitlement helpers — kept here so routes can stay thin.
 */
function isPremiumUser(user) {
  if (!user) return false;
  if (user.isPremium || user.premium) return true;
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;
  const ent = user.entitlements && user.entitlements.features;
  return !!(ent && (ent.intros || ent.unlimitedMessages || ent["intros"] === true));
}

function canSendIntro(user) {
  return isPremiumUser(user);
}

function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return /^[a-f0-9]{24}$/i.test(id);
}

/**
 * GET /api/messages/overview
 */
export async function getOverview(req, res) {
  try {
    const overviews = await Message.getOverviewForUser(req.user.id);
    if (!Array.isArray(overviews)) {
      return res.json([]);
    }
    return res.json(
      overviews.map((conv) => ({
        ...conv,
        lastMessageTime: conv?.lastMessageTime
          ? new Date(conv.lastMessageTime).toISOString()
          : null,
      }))
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[messagesController] overview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/messages/:userId
 */
export async function getThread(req, res) {
  try {
    const userId = req.user.id;
    const peerId = req.params.userId;

    if (!isValidObjectId(peerId)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: peerId },
        { sender: peerId, receiver: userId },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages || []);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[messagesController] getThread error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/messages/:userId
 */
export async function sendMessage(req, res) {
  try {
    const sender = req.user.id;
    const receiver = req.params.userId;

    if (!isValidObjectId(receiver)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    // Normalize message text (supports {text}, {message}, or raw string)
    const text =
      typeof req.body?.text === "string"
        ? req.body.text
        : typeof req.body?.message === "string"
        ? req.body.message
        : typeof req.body === "string"
        ? req.body
        : "";

    if (!text || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Message text is required" });
    }

    // Intro detection: no existing messages between the two users
    const existingCount = await Message.countDocuments({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    });

    const isIntro = existingCount === 0;

    if (isIntro && !canSendIntro(req.user)) {
      return res.status(403).json({
        ok: false,
        error: "Premium required: intro messages",
        code: "FEATURE_LOCKED",
        feature: "intros",
        canSendIntro: false,
      });
    }

    const msg = new Message({ sender, receiver, text: text.trim() });
    const saved = await msg.save();
    return res.status(201).json(saved);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[messagesController] sendMessage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Aliases (if some parts of the app expect different names)
export const listOverview = getOverview;
export const getConversation = getThread;
export const create = sendMessage;

// Default export object for lazy-loading patterns
export default {
  getOverview,
  getThread,
  sendMessage,
  // aliases
  listOverview,
  getConversation,
  create,
};
// --- REPLACE END ---
