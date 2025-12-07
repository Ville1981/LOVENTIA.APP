// File: server/src/controllers/messagesController.js

// --- REPLACE START: Messages controller (ESM, safe, mirrors router logic) ---
"use strict";

import mongoose from "mongoose";
import Message from "../models/Message.js";

/* -------------------------------------------------------------------------- */
/* Premium / entitlement helpers                                              */
/* -------------------------------------------------------------------------- */

/**
 * Determine if a user is Premium via multiple flags/structures.
 * Supports legacy flags and structured entitlements.
 */
function isPremiumUser(user) {
  if (!user) return false;

  // Legacy boolean flags
  if (user.isPremium === true || user.premium === true) return true;

  // Plan name hints
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;

  // Entitlements: tier and features
  const ent = user.entitlements || {};
  if (ent.tier === "premium") return true;

  const feat = ent.features || {};
  if (feat.unlimitedMessages === true) return true;
  if (feat.intros === true) return true;
  if (feat.introsMessaging === true) return true;

  return false;
}

/**
 * Check if sending an intro message is allowed for this user.
 * Mirrors router-level logic (ALLOW_FREE_INTROS override + premium).
 */
function canSendIntro(user) {
  // Dev / staging override: allow everyone to send intros
  if (String(process.env.ALLOW_FREE_INTROS || "") === "true") {
    return true;
  }

  if (!user) return false;

  // Prefer explicit intros feature flags if present
  const ent = user.entitlements || {};
  const feat = ent.features || {};
  if (feat.introsMessaging === true || feat.intros === true) {
    return true;
  }

  // Fallback to general premium check
  return isPremiumUser(user);
}

/**
 * Basic ObjectId validation helper to keep logs clean.
 */
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  if (mongoose?.Types?.ObjectId?.isValid) {
    return mongoose.Types.ObjectId.isValid(id);
  }
  return /^[a-f0-9]{24}$/i.test(id);
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 * NOTE: Router-level version also applies block filtering; this is a thinner variant
 * used by older routes and tests.
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
        // Normalize timestamp to ISO string for client formatting
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
 * Fetch full thread between the authenticated user and the given peer.
 * Supports both "receiver" and legacy "recipient" fields, just like the router.
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
        // me -> peer (receiver OR recipient)
        { sender: userId, $or: [{ receiver: peerId }, { recipient: peerId }] },
        // peer -> me (receiver OR recipient)
        { sender: peerId, $or: [{ receiver: userId }, { recipient: userId }] },
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
 * Send a new message from authenticated user to specified peer.
 * Enforces Premium-only "intro" logic in the same way as the router:
 *  - Intro = first message between these two users (no prior thread).
 *  - Intros require Premium / introsMessaging feature (unless ALLOW_FREE_INTROS=true).
 */
export async function sendMessage(req, res) {
  try {
    const sender = req.user.id;
    const receiver = req.params.userId;

    if (!isValidObjectId(receiver)) {
      return res.status(400).json({ ok: false, error: "Invalid user id format" });
    }

    // Normalize message text (supports {text}, {message}, or raw string body)
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

    // Intro detection: no existing messages between the two users (supports receiver|recipient)
    const existingCount = await Message.countDocuments({
      $or: [
        { sender, $or: [{ receiver }, { recipient: receiver }] },
        { sender: receiver, $or: [{ receiver: sender }, { recipient: sender }] },
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

    // Create message with dual fields (receiver|recipient, text|content) for compatibility
    const now = new Date();
    const payload = {
      sender,
      receiver,
      recipient: receiver, // legacy field
      text: text.trim(),
      content: text.trim(), // legacy "content" field
      createdAt: now,
    };

    const msg = new Message(payload);
    const saved = await msg.save();
    return res.status(201).json(saved);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[messagesController] sendMessage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* -------------------------------------------------------------------------- */
/* Aliases & default export                                                   */
/* -------------------------------------------------------------------------- */

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



