// server/routes/messages.js
const express = require('express');
const authenticate = require('../middleware/authenticate');
const Message = require('../models/Message');

const router = express.Router();

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 * Each overview contains: userId, name, avatarUrl, lastMessageTime, snippet, unreadCount.
 */
router.get(
  '/overview',
  authenticate,
  async (req, res) => {
    try {
      // Fetch overview data from Message model
      const overviews = await Message.getOverviewForUser(req.user.id);
      return res.json(
        overviews.map(conv => ({
          ...conv,
          // --- REPLACE START: ensure timestamp is ISO string for client formatting
          lastMessageTime: new Date(conv.lastMessageTime).toISOString(),
          // --- REPLACE END
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

/**
 * POST /api/messages/:userId
 * Send a new message from authenticated user to specified peer
 */
router.post(
  '/:userId',
  authenticate,
  async (req, res) => {
    try {
      const sender = req.user.id;
      const receiver = req.params.userId;
      const text = req.body.text;

      const newMessage = new Message({ sender, receiver, text });
      const saved = await newMessage.save();
      return res.status(201).json(saved);
    } catch (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// --- REPLACE START: export as CommonJS module for index.js compatibility
module.exports = router;
// --- REPLACE END
