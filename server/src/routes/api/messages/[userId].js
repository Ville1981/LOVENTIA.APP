/* File: backend/src/routes/api/messages/[userId].js */

const express = require('express');
const router = express.Router({ mergeParams: true });
const Message = require('../../models/Message');

// GET /api/messages/:userId
// Fetch conversation messages between current user and userId
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const otherId = req.params.userId;
    const conversationId = [userId, otherId].sort().join('_');

    const messages = await Message.find({ conversationId }).sort('createdAt').lean();

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// POST /api/messages/:userId
// Save a new message and emit via socket
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const otherId = req.params.userId;
    const { text } = req.body;
    const conversationId = [userId, otherId].sort().join('_');

    const message = new Message({
      conversationId,
      sender: userId,
      recipients: [otherId],
      text,
    });

    await message.save();

    // Emit via Socket
    const io = req.app.get('io');
    io.to(conversationId).emit('message', message);

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error saving message' });
  }
});

module.exports = router;
