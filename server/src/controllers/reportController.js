// File: server/src/controllers/reportController.js
// Passive report controller: stores reports, no emails, no auto-bans.

import Report from "../models/Report.js";

/**
 * Extract reporter id from req.user (supports id / _id)
 */
function getReporterId(req) {
  const u = req.user || {};
  return u.id || u._id || null;
}

/**
 * Normalize target + message ids from body.
 * Supports several alias field names so the API is robust:
 *  - targetUserId | targetId | userId | targetUser | profileId
 *  - messageId    | message_id | message | msgId
 */
function pickTargetAndMessageIds(rawBody) {
  const body = rawBody || {};

  const targetUserId =
    body.targetUserId ??
    body.targetId ??
    body.userId ??
    body.targetUser ??
    body.profileId ??
    null;

  const messageId =
    body.messageId ??
    body.message_id ??
    body.message ??
    body.msgId ??
    null;

  return {
    targetUserId: targetUserId != null && String(targetUserId).trim() !== ""
      ? String(targetUserId)
      : null,
    messageId: messageId != null && String(messageId).trim() !== ""
      ? String(messageId)
      : null,
  };
}

/**
 * POST /api/report
 *
 * Body:
 *  - targetUserId (optional, but required if messageId is not provided)
 *  - messageId    (optional, but required if targetUserId is not provided)
 *  - reason       (required, enum)
 *  - details      (optional, free text)
 *
 * Behavior:
 *  - Only logs report to DB (passive model).
 *  - No notifications, no auto-block, no auto-ban.
 */
export async function createReport(req, res, next) {
  try {
    const reporterId = getReporterId(req);

    if (!reporterId) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required to submit a report.",
        code: "REPORT_AUTH_REQUIRED",
      });
    }

    const rawBody = req.body || {};
    const { reason, details } = rawBody;
    const { targetUserId, messageId } = pickTargetAndMessageIds(rawBody);

    if (!targetUserId && !messageId) {
      return res.status(400).json({
        status: "error",
        message: "Either targetUserId or messageId is required.",
        code: "REPORT_TARGET_REQUIRED",
      });
    }

    if (!reason) {
      return res.status(400).json({
        status: "error",
        message: "Reason is required.",
        code: "REPORT_REASON_REQUIRED",
      });
    }

    const cleanedDetails =
      details && String(details).trim().length > 0
        ? String(details).trim()
        : undefined;

    const doc = await Report.create({
      reporter: reporterId,
      targetUser: targetUserId || undefined,
      message: messageId || undefined,
      reason,
      details: cleanedDetails,
      metadata: {
        userAgent: req.get("user-agent") || undefined,
        ip: req.ip,
      },
    });

    // Passive: just acknowledge, do not expose full report details back
    return res.status(201).json({
      status: "ok",
      message: "Report received. Thank you for helping keep Loventia safe.",
      code: "REPORT_CREATED",
      reportId: doc.id,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/report/mine
 *
 * Simple dev/useful endpoint: list reports submitted by the current user.
 * This is still "passive": no admin/dashboard obligations.
 */
export async function listMyReports(req, res, next) {
  try {
    const reporterId = getReporterId(req);

    if (!reporterId) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
        code: "REPORT_AUTH_REQUIRED",
      });
    }

    const items = await Report.find({ reporter: reporterId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();

    return res.json({
      status: "ok",
      items,
    });
  } catch (err) {
    return next(err);
  }
}

