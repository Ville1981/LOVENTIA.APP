// controllers/moderationController.js

/**
 * Moderation Controller
 * Handles reporting messages, fetching pending reports, and resolving reports.
 */

const ModerationReport = require('../models/ModerationReport');
const Message = require('../models/Message');
// --- REPLACE START: import moderationService to centralize logic ---
const moderationService = require('../services/moderationService');
// --- REPLACE END ---

/**
 * POST /api/moderation/report
 * Body: { messageId: string, reason: string }
 * Create a new report for the specified message.
 */
exports.reportMessage = async (req, res) => {
  try {
    const { messageId, reason } = req.body;
    if (!messageId || !reason) {
      return res.status(400).json({ error: 'messageId and reason are required.' });
    }

    // Ensure the message exists
    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // --- REPLACE START: use service to create report ---
    const report = await moderationService.createReport(
      messageId,
      req.user.id,
      reason
    );
    // --- REPLACE END ---

    return res.status(201).json({ message: 'Report submitted.', reportId: report.id });
  } catch (err) {
    console.error('Error reporting message:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * GET /api/moderation/pending
 * (Protected, admin only)
 * Returns all reports with status 'pending'.
 */
exports.getPendingReports = async (req, res) => {
  try {
    // --- REPLACE START: use service to fetch pending reports ---
    const reports = await moderationService.getPendingReports();
    // --- REPLACE END ---

    return res.json(reports);
  } catch (err) {
    console.error('Error fetching pending reports:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * POST /api/moderation/resolve
 * Body: { reportId: string, action: 'approve'|'reject' }
 * Approve (delete message) or reject (mark report resolved) a report.
 */
exports.resolveReport = async (req, res) => {
  try {
    const { reportId, action } = req.body;
    if (!reportId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'reportId and valid action are required.' });
    }

    // --- REPLACE START: delegate resolve to service ---
    await moderationService.resolveReport(reportId, action, req.user.id);
    // --- REPLACE END ---

    return res.json({ message: `Report ${action}d.` });
  } catch (err) {
    console.error('Error resolving report:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
