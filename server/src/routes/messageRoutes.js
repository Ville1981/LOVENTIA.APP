// File: server/routes/messageRoutes.js

// --- REPLACE START: convert CommonJS to ES modules and import correct middleware ---
import express from "express";
import mongoose from "mongoose";

// renamed to match your authenticate middleware export
import authenticate from "../middleware/authenticate.js";

// --- REPLACE START: lazy-load message controller to avoid import-time failure ---
let MessageCtrl = null;
async function getMessageController() {
  if (MessageCtrl) return MessageCtrl;
  try {
    const mod = await import("../controllers/messageController.js");
    MessageCtrl = mod.default || mod;
  } catch (e) {
    MessageCtrl = {};
  }
  return MessageCtrl;
}
// --- REPLACE END ---
// --- REPLACE END ---

const router = express.Router();

/**
 * GET /api/messages/conversations
 * Retrieves list of conversation summaries for the authenticated user
 */
router.get("/conversations", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { getConversations } = await getMessageController(); if (typeof getConversations !== 'function') return res.status(501).json({ error: 'Messages controller not available' }); const conversations = await getConversations(userId);
    return res.json(conversations);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * GET /api/messages/:partnerId
 * Retrieves messages between authenticated user and partner
 */
router.get("/:partnerId", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.partnerId;

    // --- REPLACE START: handle non-ObjectId mock partnerId ---
    if (!mongoose.isValidObjectId(partnerId)) {
      return res.json([]);
    }
    // --- REPLACE END ---

    const { getMessagesBetween } = await getMessageController(); if (typeof getMessagesBetween !== 'function') return res.status(501).json({ error: 'Messages controller not available' }); const messages = await getMessagesBetween(userId, partnerId);
    return res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * POST /api/messages/:partnerId
 * Sends a message from authenticated user to partner
 */
router.post("/:partnerId", authenticate, async (req, res) => {
  try {
    const senderId = req.user.id;
    const recipientId = req.params.partnerId;
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Message text is required" });
    }

    // --- REPLACE START: handle non-ObjectId mock recipient ---
    if (!mongoose.isValidObjectId(recipientId)) {
      const now = new Date();
      const mockMsg = {
        _id: new mongoose.Types.ObjectId(),
        sender: senderId,
        receiver: recipientId,
        text,
        createdAt: now,
        updatedAt: now,
      };
      return res.status(201).json(mockMsg);
    }
    // --- REPLACE END ---

    const { sendMessage } = await getMessageController(); if (typeof sendMessage !== 'function') return res.status(501).json({ error: 'Messages controller not available' }); const message = await sendMessage(senderId, recipientId, text);
    return res.status(201).json(message);
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
