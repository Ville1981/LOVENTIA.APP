// src/controllers/messagesOverview.js
// Controller for GET /api/messages/overview
// Returns a list of conversations for the authenticated user

import { getConversationsForUser } from '../services/conversationService';

/**
 * GET /api/messages/overview
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getMessagesOverview(req, res) {
  try {
    const userId = req.user.id;
    // Fetch conversations with last message & timestamp
    const overview = await getConversationsForUser(userId);
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Error fetching messages overview:', error);
    return res.status(500).json({ success: false, message: 'Unable to load conversations.' });
  }
}

// Remember to register this controller in your Express router:
//   router.get('/api/messages/overview', authenticate, getMessagesOverview);
