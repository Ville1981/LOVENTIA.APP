// server/controllers/messageController.js

import mongoose from 'mongoose';

// --- REPLACE START: CJS/ESM interop for Message model default import ---
import * as MessageModule from '../models/Message.js';
const Message = MessageModule.default || MessageModule;
// --- REPLACE END ---

// --- REPLACE START: convert to ES modules and add named exports ---

/**
 * Retrieves conversation summaries for a given user.
 * Groups messages by peer and returns the latest snippet and timestamp.
 * @param {string} userId - MongoDB ObjectId string of the current user.
 * @returns {Promise<Array<{userId:string,snippet:string,lastMessageTime:Date}>>}
 */
export async function getConversations(userId) {
  // Convert to ObjectId once to avoid repeating in pipeline
  const oid = new mongoose.Types.ObjectId(String(userId));

  // Fetch latest message per conversation
  const pipeline = [
    { $match: { $or: [{ sender: oid }, { receiver: oid }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$sender', oid] }, '$receiver', '$sender']
        },
        lastMessage:   { $first: '$text' },
        lastTimestamp: { $first: '$createdAt' }
      }
    },
    {
      $project: {
        userId: { $toString: '$_id' },
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
 * Retrieves all messages between two users, sorted chronologically.
 * @param {string} userA - ObjectId string
 * @param {string} userB - ObjectId string
 * @returns {Promise<Array>}
 */
export async function getMessagesBetween(userA, userB) {
  const a = new mongoose.Types.ObjectId(String(userA));
  const b = new mongoose.Types.ObjectId(String(userB));

  const messages = await Message.find({
    $or: [
      { sender: a, receiver: b },
      { sender: b, receiver: a }
    ]
  })
    .sort({ createdAt: 1 })
    .lean()
    .exec();

  return messages;
}

/**
 * Creates and saves a new message document.
 * @param {string} senderId - ObjectId string
 * @param {string} receiverId - ObjectId string
 * @param {string} text
 * @returns {Promise<Object>} saved message
 */
export async function sendMessage(senderId, receiverId, text) {
  const sender   = new mongoose.Types.ObjectId(String(senderId));
  const receiver = new mongoose.Types.ObjectId(String(receiverId));

  const msg = new Message({ sender, receiver, text });
  const saved = await msg.save();
  return saved;
}

// --- REPLACE END ---
