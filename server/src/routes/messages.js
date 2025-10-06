// File: server/src/routes/messages.js

// --- REPLACE START: switch to ESM imports (express, auth, moderation, model, helpers) ---
"use strict";

import express from "express";
import mongoose from "mongoose";
import authenticate from "../middleware/authenticate.js";
import { profanityFilter, moderationRateLimiter } from "../middleware/moderation.js";
// --- REPLACE START: robust Message model import (ESM + CJS interop) ---
import * as MessageNS from "../models/Message.js";
const Message = MessageNS.default || MessageNS.Message || MessageNS;
// --- REPLACE END ---
// --- REPLACE START: import User model to fetch premium flags if req.user is minimal ---
import User from "../models/User.js";
// --- REPLACE END ---

// --- REPLACE END ---

const router = express.Router();

// --- REPLACE START: helpers for Premium/feature gating (intros) ---
/**
 * Determine if a user is Premium via multiple flags/structures.
 * Supports legacy flags and structured entitlements.
 */
function isPremiumUser(user) {
  if (!user) return false;
  if (user.isPremium || user.premium) return true;
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;

  // Entitlements (support both "intros" and "introsMessaging" keys)
  const ent = user.entitlements && user.entitlements.features;
  if (ent) {
    if (ent.unlimitedMessages === true) return true;
    if (ent.intros === true) return true;
    if (ent.introsMessaging === true) return true;
  }
  return false;
}

/**
 * Check if sending an intro message is allowed for this user.
 * Premium users (or users with `entitlements.features.intros|introsMessaging`) are allowed.
 */
function canSendIntro(user) {
  // Optional dev override
  if (String(process.env.ALLOW_FREE_INTROS || "") === "true") return true;
  return isPremiumUser(user);
}

/** Very small helper for ObjectId format validation (keeps logs clean). */
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  if (mongoose?.Types?.ObjectId?.isValid) return mongoose.Types.ObjectId.isValid(id);
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Fetch a richer user object when req.user lacks entitlement flags. */
async function getRichUser(req) {
  const u = req.user || {};
  // If it already looks rich, skip DB
  if (u.premium || u.isPremium || (u.entitlements && u.entitlements.features)) return u;
  try {
    const fromDb = await User.findById(u.id || u._id).lean();
    return fromDb || u;
  } catch {
    return u;
  }
}
// --- REPLACE END ---

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 * Each overview contains: userId, name, avatarUrl, lastMessageTime, snippet, unreadCount.
 */
router.get(
  "/overview",
  authenticate,
  // --- REPLACE START: apply moderation middlewares to overview route ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      // Fetch overview data from Message model (guard if method not present)
      if (typeof Message.getOverviewForUser !== "function") {
        return res.json([]); // graceful fallback
      }
      const overviews = await Message.getOverviewForUser(req.user.id);
      if (!Array.isArray(overviews)) {
        return res.json([]);
      }
      return res.json(
        overviews.map((conv) => ({
          ...conv,
          // --- REPLACE START: ensure timestamp is ISO string for client formatting ---
          lastMessageTime: conv?.lastMessageTime
            ? new Date(conv.lastMessageTime).toISOString()
            : null,
          // --- REPLACE END ---
        }))
      );
    } catch (err) {
      console.error("Error fetching message overview:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// --- REPLACE START: move can-send-intro before '/:userId' to avoid route shadowing ---
/**
 * GET /api/messages/can-send-intro/:userId
 * Returns whether the current authenticated user can send an intro to :userId.
 * Premium users have this capability; non-premium are blocked at server.
 */
router.get(
  "/can-send-intro/:userId",
  authenticate,
  moderationRateLimiter,
  async (req, res) => {
    try {
      const targetId = req.params.userId;
      if (!isValidObjectId(targetId)) {
        return res.status(400).json({ ok: false, error: "Invalid user id format" });
      }
      const richUser = await getRichUser(req);
      const allowed = canSendIntro(richUser);
      return res.json({
        ok: true,
        canSendIntro: allowed,
        feature: "intros",
      });
    } catch (err) {
      console.error("Error checking intro capability:", err);
      return res.status(500).json({ ok: false, error: "Internal server error" });
    }
  }
);
// --- REPLACE END ---

/**
 * GET /api/messages/:userId
 * Fetch all messages between authenticated user and specified peer
 */
router.get(
  "/:userId",
  authenticate,
  // --- REPLACE START: apply moderation middlewares to message fetch route ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      const userId = req.user.id;
      const peerId = req.params.userId;

      // Basic validation to avoid noisy queries
      if (!isValidObjectId(peerId)) {
        return res.status(400).json({ ok: false, error: "Invalid user id format" });
      }

      // --- REPLACE START: robust thread fetch (supports receiver|recipient) ---
      const messages = await Message.find({
        $or: [
          // me -> peer (receiver OR recipient)
          { sender: userId, $or: [{ receiver: peerId }, { recipient: peerId }] },
          // peer -> me (receiver OR recipient)
          { sender: peerId, $or: [{ receiver: userId }, { recipient: userId }] },
        ],
      }).sort({ createdAt: 1 });
      // --- REPLACE END ---

      return res.json(messages || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/messages/:userId
 * Send a new message from authenticated user to specified peer
 */
router.post(
  "/:userId",
  authenticate,
  // --- REPLACE START: apply moderation middlewares to sending messages ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      const sender = req.user.id;
      const receiver = req.params.userId;

      // Validate receiver id
      if (!isValidObjectId(receiver)) {
        return res.status(400).json({ ok: false, error: "Invalid user id format" });
      }

      // Normalize message text from various possible shapes
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

      // --- REPLACE START: enforce "intro messages" are Premium-only (with rich user) ---
      // Intro detection compatible with receiver|recipient
      const existingCount = await Message.countDocuments({
        $or: [
          { sender, $or: [{ receiver }, { recipient: receiver }] },
          { sender: receiver, $or: [{ receiver: sender }, { recipient: sender }] },
        ],
      });

      const isIntro = existingCount === 0;

      if (isIntro) {
        const richUser = await getRichUser(req);
        if (!canSendIntro(richUser)) {
          return res.status(403).json({
            ok: false,
            error: "Premium required: intro messages",
            code: "FEATURE_LOCKED",
            feature: "intros",
            canSendIntro: false,
          });
        }
      }
      // --- REPLACE END ---

      // --- REPLACE START: create message with dual fields (receiver|recipient, text|content) ---
      const now = new Date();
      const payload = {
        sender,
        receiver,
        recipient: receiver, // keep compatibility with legacy schema
        text: text.trim(),
        content: text.trim(), // legacy content field
        createdAt: now,
      };

      const newMessage = new Message(payload);
      const saved = await newMessage.save();
      return res.status(201).json(saved);
      // --- REPLACE END ---
    } catch (err) {
      console.error("Error sending message:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---
