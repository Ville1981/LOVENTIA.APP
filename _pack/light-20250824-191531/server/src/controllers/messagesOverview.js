// Controller for GET /api/messages/overview
// Returns a list of conversations for the authenticated user

// --- REPLACE START: convert ESM import/exports to CommonJS ---
const { getConversationsForUser } = require('../services/conversationService');
// --- REPLACE END ---

/**
 * GET /api/messages/overview
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getMessagesOverview(req, res) {
  try {
    const userId = req.user.id;
    // Fetch conversations with last message & timestamp
    const overview = await getConversationsForUser(userId);
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error('Error fetching messages overview:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Unable to load conversations.' });
  }
}

// --- REPLACE START: export function in CommonJS ---
module.exports = { getMessagesOverview };
// --- REPLACE END ---
