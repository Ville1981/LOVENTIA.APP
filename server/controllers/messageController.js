// server/controllers/messageController.js

import Message from '../models/Message.js';
import mongoose from 'mongoose';

// --- REPLACE START: convert to ES modules and add named exports ---

/**
 * Retrieves conversation summaries for a given user.
 * Groups messages by peer and returns the latest snippet and timestamp.
 */
export async function getConversations(userId) {
  // Fetch latest message per conversation
  const pipeline = [
    { $match: { $or: [{ sender: mongoose.Types.ObjectId(userId) }, { receiver: mongoose.Types.ObjectId(userId) }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$sender', mongoose.Types.ObjectId(userId)] },
            '$receiver',
            '$sender'
          ]
        },
        lastMessage: { $first: '$text' },
        lastTimestamp: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        userId: '$_id',
        snippet: '$lastMessage',
        lastMessageTime: '$lastTimestamp',
        _id: 0
      }
    },
    { $sort: { lastMessageTime: -1 } }
  ];

  const results = await Message.aggregate(pipeline).exec();
  return results;
}

/**
 * Retrieves all messages between two users, sorted chronologically
 */
export async function getMessagesBetween(userA, userB) {
  const messages = await Message.find({
    $or: [
      { sender: userA, receiver: userB },
      { sender: userB, receiver: userA }
    ]
  })
    .sort({ createdAt: 1 })
    .lean()
    .exec();

  return messages;
}

/**
 * Creates and saves a new message document
 */
export async function sendMessage(senderId, receiverId, text) {
  const msg = new Message({ sender: senderId, receiver: receiverId, text });
  const saved = await msg.save();
  return saved;
}

// --- REPLACE END ---
