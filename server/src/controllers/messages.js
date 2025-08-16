/**
 * Controller for GET/POST /api/messages/:userId
 * Handles fetching and saving messages between two users
 */

// --- REPLACE START: convert ESM import/exports to CommonJS ---
const { fetchMessagesBetween, saveMessage } = require("../services/messageService");
// --- REPLACE END ---

/**
 * GET /api/messages/:userId
 * Fetches message history between req.user.id and param userId
 */
async function getMessages(req, res) {
  try {
    const me = req.user && (req.user.id || req.user.userId); // support both id/userId
    const peer = req.params.userId;
    const messages = await fetchMessagesBetween(me, peer);
    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load messages." });
  }
}

/**
 * POST /api/messages/:userId
 * Saves a new message from req.user.id to param userId
 * Body: { text: string }
 */
async function postMessage(req, res) {
  try {
    const sender = req.user && (req.user.id || req.user.userId); // support both id/userId
    const recipient = req.params.userId;
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid message payload." });
    }
    const saved = await saveMessage({ sender, recipient, text: text.trim() });
    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error("Error saving message:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to send message." });
  }
}

// --- REPLACE START: export functions in CommonJS ---
module.exports = { getMessages, postMessage };
// --- REPLACE END ---
