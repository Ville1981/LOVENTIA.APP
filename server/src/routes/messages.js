// File: server/routes/messages.js

// --- REPLACE START: switch to ESM import for express ---
import express from "express";
// --- REPLACE END ---
const authenticate = require('../middleware/authenticate');
const { profanityFilter, moderationRateLimiter } = require('../middleware/moderation');
const Message = require('../models/Message');

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
  const ent = user.entitlements && user.entitlements.features;
  return !!(ent && (ent.intros || ent.unlimitedMessages || ent['intros'] === true));
}

/**
 * Check if sending an intro message is allowed for this user.
 * Premium users (or users with `entitlements.features.intros`) are allowed.
 */
function canSendIntro(user) {
  return isPremiumUser(user);
}
// --- REPLACE END ---

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 * Each overview contains: userId, name, avatarUrl, lastMessageTime, snippet, unreadCount.
 */
router.get(
  '/overview',
  authenticate,
  // --- REPLACE START: apply moderation middlewares to overview route ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      // Fetch overview data from Message model
      const overviews = await Message.getOverviewForUser(req.user.id);
      return res.json(
        overviews.map(conv => ({
          ...conv,
          // --- REPLACE START: ensure timestamp is ISO string for client formatting ---
          lastMessageTime: new Date(conv.lastMessageTime).toISOString(),
          // --- REPLACE END ---
        }))
      );
    } catch (err) {
      console.error('Error fetching message overview:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/messages/:userId
 * Fetch all messages between authenticated user and specified peer
 */
router.get(
  '/:userId',
  authenticate,
  // --- REPLACE START: apply moderation middlewares to message fetch route ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      const userId = req.user.id;
      const peerId = req.params.userId;
      const messages = await Message.find({
        $or: [
          { sender: userId, receiver: peerId },
          { sender: peerId, receiver: userId }
        ]
      }).sort({ createdAt: 1 });
      return res.json(messages);
    } catch (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// --- REPLACE START: new helper endpoint to check intro entitlement for a target ---
/**
 * GET /api/messages/can-send-intro/:userId
 * Returns whether the current authenticated user can send an intro to :userId.
 * Premium users have this capability; non-premium are blocked at server.
 */
router.get(
  '/can-send-intro/:userId',
  authenticate,
  moderationRateLimiter,
  async (req, res) => {
    try {
      const allowed = canSendIntro(req.user);
      return res.json({
        ok: true,
        canSendIntro: allowed,
        feature: 'intros',
      });
    } catch (err) {
      console.error('Error checking intro capability:', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);
// --- REPLACE END ---

/**
 * POST /api/messages/:userId
 * Send a new message from authenticated user to specified peer
 */
router.post(
  '/:userId',
  authenticate,
  // --- REPLACE START: apply moderation middlewares to sending messages ---
  moderationRateLimiter,
  profanityFilter,
  // --- REPLACE END ---
  async (req, res) => {
    try {
      const sender = req.user.id;
      const receiver = req.params.userId;
      const text = req.body.text;

      // --- REPLACE START: enforce "intro messages" are Premium-only ---
      // Detect "intro" => no existing messages in either direction between the two users.
      const existingCount = await Message.countDocuments({
        $or: [
          { sender, receiver },
          { sender: receiver, receiver: sender }
        ]
      });

      const isIntro = existingCount === 0;

      if (isIntro && !canSendIntro(req.user)) {
        return res.status(403).json({
          ok: false,
          error: 'Premium required: intro messages',
          code: 'FEATURE_LOCKED',
          feature: 'intros',
          canSendIntro: false,
        });
      }
      // --- REPLACE END ---

      const newMessage = new Message({ sender, receiver, text });
      const saved = await newMessage.save();
      return res.status(201).json(saved);
    } catch (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// --- REPLACE START: export as CommonJS module for index.js compatibility ---
// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---
// --- REPLACE END ---
