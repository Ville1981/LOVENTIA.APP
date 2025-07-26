const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
// --- REPLACE START: use authenticate middleware ---
const authenticate = require('../middleware/authenticate');
// --- REPLACE END ---

const Message = require('../models/Message');

/**
 * GET /api/messages/overview
 * Returns an array of conversation overviews for the authenticated user.
 */
router.get(
  '/overview',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const msgs = await Message.find({
        $or: [
          { sender: userId },
          { receiver: userId }
        ]
      }).sort({ createdAt: -1 });

      const peersMap = {};
      msgs.forEach(msg => {
        const peer = msg.sender.toString() === userId ? msg.receiver : msg.sender;
        const peerId = peer.toString();
        if (!peersMap[peerId]) {
          peersMap[peerId] = {
            userId: peerId,
            snippet: msg.text,
            lastMessageTime: msg.createdAt.toISOString(),
            unreadCount: 0
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

      // --- REPLACE START: handle non-ObjectId mock peerId ---
      if (!mongoose.isValidObjectId(peerId)) {
        // return empty array for mock users
        return res.json([]);
      }
      // --- REPLACE END ---

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

      // --- REPLACE START: handle non-ObjectId mock receiver ---
      if (!mongoose.isValidObjectId(receiver)) {
        // return mock message stub
        const now = new Date();
        const mockMsg = {
          _id: new mongoose.Types.ObjectId(),
          sender,
          receiver,
          text,
          createdAt: now,
          updatedAt: now
        };
        return res.status(201).json(mockMsg);
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

module.exports = router;
