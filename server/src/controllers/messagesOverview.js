// File: server/src/controllers/messagesOverview.js

// Controller for GET /api/messages/overview
// Returns a list of conversations for the authenticated user

// --- REPLACE START: import conversation service with ESM/CJS interop ---
import * as ConversationServiceNS from "../services/conversationService.js";

const ConversationService =
  ConversationServiceNS.default || ConversationServiceNS || {};
const { getConversationsForUser } = ConversationService;
// --- REPLACE END ---

/**
 * GET /api/messages/overview
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function getMessagesOverview(req, res) {
  try {
    const userId = req.user.id;
    // Fetch conversations with last message & timestamp
    const overview = await getConversationsForUser(userId);
    return res.json({ success: true, data: overview });
  } catch (error) {
    console.error("Error fetching messages overview:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load conversations." });
  }
}

// --- REPLACE START: export function in ESM ---
export { getMessagesOverview };
// --- REPLACE END ---


