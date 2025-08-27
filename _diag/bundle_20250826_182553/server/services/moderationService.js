// services/moderationService.js

/**
 * Service layer for moderation logic.
 * Handles creating reports, fetching pending reports, 
 * and resolving (approving/rejecting) reports.
 */

const ModerationReport = require('../models/ModerationReport');
const Message = require('../models/Message');

module.exports = {
  /**
   * Create a new moderation report.
   * @param {string} messageId 
   * @param {string} reporterId 
   * @param {string} reason 
   * @returns {Promise<ModerationReport>}
   */
  createReport: async (messageId, reporterId, reason) => {
    const report = new ModerationReport({
      message: messageId,
      reporter: reporterId,
      reason,
      status: 'pending',
      createdAt: new Date(),
    });
    return report.save();
  },

  /**
   * Get all reports in 'pending' status.
   * @returns {Promise<ModerationReport[]>}
   */
  getPendingReports: async () => {
    return ModerationReport.find({ status: 'pending' })
      .populate('message reporter', 'text email')
      .sort({ createdAt: -1 })
      .lean();
  },

  /**
   * Resolve a report by approving (deleting message) or rejecting it.
   * @param {string} reportId 
   * @param {'approve'|'reject'} action 
   * @param {string} resolverId 
   * @returns {Promise<ModerationReport>}
   */
  resolveReport: async (reportId, action, resolverId) => {
    const report = await ModerationReport.findById(reportId);
    if (!report) throw new Error('Report not found');
    if (report.status !== 'pending') throw new Error('Report already resolved');

    if (action === 'approve') {
      // delete the offending message
      await Message.findByIdAndDelete(report.message);
      report.status = 'approved';
    } else {
      // reject the report, leave message intact
      report.status = 'rejected';
    }

    report.resolvedBy = resolverId;
    report.resolvedAt = new Date();
    return report.save();
  },
};
