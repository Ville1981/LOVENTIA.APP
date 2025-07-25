const express = require('express');
const router = express.Router();

// --- REPLACE START: correct path to authenticate middleware ---
const authenticate = require('../middleware/authenticate');
// --- REPLACE END ---

const Message = require('../models/Message');

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 * Each overview contains: userId, snippet, lastMessageTime, unreadCount.
 */
router.get(
  '/overview',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      // Fetch messages involving the user, sorted newest first
      const msgs = await Message.find({
        $or: [
          { sender: userId },
          { receiver: userId }
        ]
      }).sort({ createdAt: -1 });

      // Aggregate latest message per peer
      const peersMap = {};
      msgs.forEach(msg => {
        const peerId = msg.sender.toString() === userId
          ? msg.receiver.toString()
          : msg.sender.toString();
        if (!peersMap[peerId]) {
          peersMap[peerId] = {
            userId: peerId,
            snippet: msg.text,
            lastMessageTime: msg.createdAt.toISOString(),
            unreadCount: 0 // TODO: implement real unread count
          };
        }
      });

      return res.json(Object.values(peersMap));
    } catch (err) {
      console.error('Error fetching conversation overview:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/messages/:userId
 * Fetch all messages between authenticated user and specified peer.
 */
router.get(
  '/:userId',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const peerId = req.params.userId;
      // Validate ObjectId format
      if (!peerId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
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
 * Send a new message from authenticated user to specified peer.
 */
router.post(
  '/:userId',
  authenticate,
  async (req, res) => {
    try {
      const sender = req.user.id;
      const receiver = req.params.userId;
      const { text } = req.body;
      // Validate receiver ID
      if (!receiver.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid receiver ID' });
      }
      const newMessage = new Message({ sender, receiver, text });
      const saved = await newMessage.save();
      return res.status(201).json(saved);
    } catch (err) {
      console.error('Error sending message:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Export the router
module.exports = router;
