/* File: backend/src/routes/api/messages/overview.js */

const express = require('express');
const router = express.Router();
const Message = require('../../models/Message');
const User = require('../../models/User');

// GET /api/messages/overview
// Returns list of conversations with latest message
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    // Aggregate to get last message per conversation
    const conversations = await Message.aggregate([
      { $match: { recipients: userId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'sender'
        }
      },
      { $unwind: '$sender' },
      {
        $project: {
          conversationId: '$_id',
          text: '$lastMessage.text',
          sender: { id: '$sender._id', name: '$sender.name' },
          createdAt: '$lastMessage.createdAt'
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching overview' });
  }
});

module.exports = router;
