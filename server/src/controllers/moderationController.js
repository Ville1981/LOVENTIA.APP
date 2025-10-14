// server/src/controllers/moderationController.js

/**
 * Moderation controller (ESM bridge with safe fallbacks)
 *
 * This file ensures the routes can import:
 *   import { reportMessage, getPendingReports, resolveReport } from "../controllers/moderationController.js";
 *
 * It will first try to load an existing legacy controller from common locations
 * (CJS or ESM). If none is found, it provides minimal, non-breaking fallback
 * handlers so the server can boot and endpoints respond in a predictable way.
 */

// --- REPLACE START: loader that tolerates CJS/ESM + missing files ---
import { createRequire } from "module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

// Attempt to find an existing implementation in legacy locations.
async function loadLegacyController() {
  const candidates = [
    // Common CJS/ESM locations outside src/
    "../../controllers/moderationController.cjs",
    "../../controllers/moderationController.js",
    "../../controllers/moderation.js",
    // Sometimes kept inside src in different structure
    "../controllers/moderationController.cjs",
    "../controllers/moderation.cjs",
  ];

  // Try require() first (fast path for CJS)
  for (const rel of candidates) {
    try {
      const abs = path.resolve(path.dirname(new URL(import.meta.url).pathname), rel);
      // eslint-disable-next-line import/no-commonjs, global-require
      const mod = require(abs);
      if (mod) return mod.default || mod;
    } catch {
      // continue
    }
  }

  // Try dynamic import for ESM candidates
  for (const rel of candidates) {
    try {
      const abs = path.resolve(path.dirname(new URL(import.meta.url).pathname), rel);
      const esm = await import(pathToFileURL(abs).href);
      if (esm) return esm.default || esm;
    } catch {
      // continue
    }
  }

  return null;
}
// --- REPLACE END ---

// --- REPLACE START: safe fallbacks (used if no legacy controller found) ---
/**
 * Fallback: record a report request. Replace with real logic when legacy controller is available.
 */
async function fallbackReportMessage(req, res) {
  try {
    const { messageId, reason } = req.body || {};
    if (!messageId || !reason) {
      return res.status(400).json({ error: "messageId and reason are required" });
    }
    // In a real impl, persist the report and notify moderators.
    return res.status(202).json({
      status: "accepted",
      message: "Report received",
      data: { messageId, reason },
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to submit report" });
  }
}

/**
 * Fallback: return an empty pending reports list.
 */
async function fallbackGetPendingReports(_req, res) {
  try {
    // In a real impl, query DB for pending reports.
    return res.json({ reports: [] });
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch pending reports" });
  }
}

/**
 * Fallback: acknowledge a resolve action.
 */
async function fallbackResolveReport(req, res) {
  try {
    const { reportId, action } = req.body || {};
    if (!reportId || !action || !["approve", "reject"].includes(String(action))) {
      return res
        .status(400)
        .json({ error: "reportId and action ('approve'|'reject') are required" });
    }
    // In a real impl, mark the report resolved in DB.
    return res.json({ status: "ok", reportId, action });
  } catch (e) {
    return res.status(500).json({ error: "Failed to resolve report" });
  }
}
// --- REPLACE END ---

// --- REPLACE START: export resolved handlers (preferring legacy when available) ---
let impl = await loadLegacyController();

const reportMessage =
  (impl && (impl.reportMessage || impl.default?.reportMessage)) || fallbackReportMessage;

const getPendingReports =
  (impl && (impl.getPendingReports || impl.default?.getPendingReports)) ||
  fallbackGetPendingReports;

const resolveReport =
  (impl && (impl.resolveReport || impl.default?.resolveReport)) || fallbackResolveReport;

export { reportMessage, getPendingReports, resolveReport };
export default { reportMessage, getPendingReports, resolveReport };
// --- REPLACE END ---
