// File: server/src/routes/discoverRoutes.js

// --- REPLACE START: ESM router with safe fallbacks and correct res.json hijack ---
/**
 * Purpose:
 * - Provide `/api/discover` routes with consistent output shapes.
 * - Delegate to optional `../controllers/discoverController.js` if present.
 * - Normalize outbound user objects using shared utils.
 * - If no external controller is present, return an empty feed
 *   OR (when `?includeSelf=1`) include the current user from DB.
 *
 * Behavior:
 * - GET / -> returns discovery feed.
 *   Query params (optional): minAge, maxAge, gender, orientation, mustHavePhoto,
 *   page, limit, includeSelf
 *
 * Notes:
 * - This router does not enforce auth directly; mount-level middleware should handle it.
 * - All comments are in English per requirements.
 */
'use strict';

import express from "express";
import normalizeUserOut, { normalizeUsersOut } from "../utils/normalizeUserOut.js";
import User from "../models/User.js";

const router = express.Router();

let _discoverHandler = null;
async function getDiscoverController() {
  if (_discoverHandler) return _discoverHandler;
  try {
    const mod = await import("../controllers/discoverController.js");
    // Accept default export, or named export `discover`
    _discoverHandler = mod.default || mod.discover || null;
  } catch {
    _discoverHandler = null;
  }
  return _discoverHandler;
}

router.get("/", async (req, res, next) => {
  try {
    const handler = await getDiscoverController();

    if (typeof handler === "function") {
      // ✅ Correct, context-safe hijack: bind original res.json and override in-place.
      //    Do NOT spread `res` into a new object (it breaks Express internals).
      let wrote = false;
      const originalJson = res.json.bind(res);

      // Monkey-patch res.json for the duration of this handler
      res.json = (payload) => {
        try {
          if (Array.isArray(payload)) {
            wrote = true;
            return originalJson(normalizeUsersOut(payload));
          }
          if (payload && Array.isArray(payload.users)) {
            const normalized = { ...payload, users: normalizeUsersOut(payload.users) };
            wrote = true;
            return originalJson(normalized);
          }
          if (payload && typeof payload === "object" && payload._id && !payload.users) {
            wrote = true;
            return originalJson(normalizeUserOut(payload));
          }
        } catch {
          // Fall through to default payload on any normalization error
        }
        wrote = true;
        return originalJson(payload);
      };

      // Call controller with the real res (now patched), not a cloned object
      await handler(req, res, next);

      // If controller already answered, stop here
      if (wrote) return;
      // Fall through to default feed if controller called next() without responding
    }

    // Default implementation (no external controller):
    // Return empty feed, but if `includeSelf=1` and the user exists, include self.
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10) || 20));
    const includeSelf =
      String(req.query.includeSelf ?? "").trim() === "1" ||
      String(req.query.includeSelf ?? "").toLowerCase() === "true";

    const outUsers = [];

    if (includeSelf) {
      try {
        const userId =
          req?.user?._id || req?.user?.id || req?.user?.userId || req?.userId || null;
        if (userId) {
          const me = await User.findById(userId).lean().exec();
          if (me) outUsers.push(normalizeUserOut(me));
        }
      } catch {
        // Non-fatal in fallback path
      }
    }

    return res.json({
      users: outUsers,
      meta: {
        page,
        limit,
        total: outUsers.length,
        pageCount: outUsers.length ? 1 : 0,
        hasPrev: page > 1,
        hasNext: false,
      },
    });
  } catch (err) {
    return next(err);
  }
});
// --- REPLACE END ---

// ✅ Export both named and default for shim compatibility
export { router };
export default router;
