// src/controllers/messages.js
// Controller for GET/POST /api/messages/:userId
// Handles fetching and saving messages between two users

import { fetchMessagesBetween, saveMessage } from '../services/messageService';

/**
 * GET /api/messages/:userId
 * Fetches message history between req.user.id and param userId
 */
export async function getMessages(req, res) {
  try {
    const me = req.user.id;
    const peer = req.params.userId;
    const messages = await fetchMessagesBetween(me, peer);
    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ success: false, message: 'Unable to load messages.' });
  }
}

/**
 * POST /api/messages/:userId
 * Saves a new message from req.user.id to param userId
 * Body: { text: string }
 */
export async function postMessage(req, res) {
  try {
    const sender = req.user.id;
    const recipient = req.params.userId;
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid message payload.' });
    }
    const saved = await saveMessage({ sender, recipient, text });
    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Error saving message:', error);
    return res.status(500).json({ success: false, message: 'Unable to send message.' });
  }
}

// Remember to register these in your Express router:
//   router.get('/api/messages/:userId', authenticate, getMessages);
//   router.post('/api/messages/:userId', authenticate, postMessage);
