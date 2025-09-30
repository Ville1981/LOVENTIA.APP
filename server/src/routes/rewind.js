// PATH: server/src/routes/rewind.js

// --- REPLACE START: ESM-compatible rewind route (Premium users have unlimited rewinds) ---
/* eslint-disable no-console */
/**
 * This router provides a single POST endpoint to undo the user's last action
 * (like or pass). It is **Premium-gated** and supports multiple legacy / new
 * user payload shapes.
 *
 * Mount at: app.use("/api/rewind", rewindRouter);
 *
 * Requirements:
 *  - Project uses `"type": "module"` → use ESM `import`/`export default`.
 *  - Upstream auth middleware should set `req.user` (or at least `req.userId`).
 */

"use strict";

import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

// Parse JSON bodies for this router (kept even if app has global parsers)
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Helper: resolve current user id from typical shapes.
 */
function getCurrentUserId(req) {
  return (
    req?.user?._id ||
    req?.user?.id ||
    req?.user?.userId ||
    req?.userId ||
    null
  );
}

/**
 * Helper: resolve current User document from request.
 * - Prefer req.user if populated by upstream auth middleware.
 * - Fallback for local tools: Authorization: Bearer <ObjectId>.
 */
async function resolveCurrentUser(req) {
  // Prefer a hydrated doc placed by auth middleware
  const idFromUser = getCurrentUserId(req);
  if (idFromUser) {
    if (req.user && typeof req.user.save === "function") return req.user;
    try {
      return await User.findById(idFromUser).exec();
    } catch {
      // ignore and try fallback
    }
  }

  // Dev/test fallback: Authorization: Bearer <userId>
  try {
    const auth = String(req.headers.authorization || "");
    const [scheme, token] = auth.split(" ");
    if (scheme === "Bearer" && mongoose.isValidObjectId(token)) {
      return await User.findById(token).exec();
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Helper: check Premium entitlement for unlimited rewinds.
 * - Supports legacy `isPremium`/`premium` flags
 * - Or structured entitlements.features.unlimitedRewinds
 * - Or plan name matching (premium/pro/plus)
 */
function hasUnlimitedRewinds(user) {
  if (!user) return false;

  // Legacy booleans
  if (user.isPremium === true || user.premium === true) return true;

  // Structured entitlements
  const feat = user?.entitlements?.features;
  if (feat && (feat.unlimitedRewinds === true || feat["unlimitedRewinds"] === true)) {
    return true;
  }

  // Plan name
  if (user.plan && /premium|pro|plus/i.test(String(user.plan))) return true;

  return false;
}

/**
 * Helper: choose which array to rewind from.
 * - scope: 'likes' | 'passes'
 * - If not provided, prefer 'likes' if it has items, else 'passes'
 */
function chooseScope(user, requestedScope) {
  const scope = (requestedScope || "").toLowerCase();
  if (scope === "likes" || scope === "passes") return scope;

  if (Array.isArray(user.likes) && user.likes.length > 0) return "likes";
  if (Array.isArray(user.passes) && user.passes.length > 0) return "passes";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * POST /
 * (Mounted at /api/rewind)
 *
 * Body (JSON):
 *   - scope?: 'likes' | 'passes'
 *
 * Behavior:
 *   - Premium users: unlimited rewinds (no quota)
 *   - Non-premium users: blocked with FEATURE_LOCKED (UI should CTA to upgrade)
 *   - Pops the last entry from the chosen list and persists the change
 *
 * Response 200:
 *   { ok: true, rewound: 'likes'|'passes', targetUserId, message }
 *
 * Error 401: { ok:false, error:'Unauthorized' }
 * Error 403: { ok:false, error:'Premium required: unlimitedRewinds', code:'FEATURE_LOCKED', feature:'unlimitedRewinds' }
 * Error 400: { ok:false, error:'Nothing to rewind' | 'No entries in X to rewind' }
 * Error 500: { ok:false, error:'Internal Server Error' }
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const current = await resolveCurrentUser(req);
    if (!current) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // Enforce Premium entitlement server-side
    if (!hasUnlimitedRewinds(current)) {
      return res.status(403).json({
        ok: false,
        error: "Premium required: unlimitedRewinds",
        code: "FEATURE_LOCKED",
        feature: "unlimitedRewinds",
      });
    }

    const scope = chooseScope(current, req.body && req.body.scope);
    if (!scope) {
      return res.status(400).json({
        ok: false,
        error: "Nothing to rewind",
        detail: "Neither likes nor passes contain any items.",
      });
    }

    if (!Array.isArray(current[scope]) || current[scope].length === 0) {
      return res.status(400).json({
        ok: false,
        error: `No entries in ${scope} to rewind`,
      });
    }

    // Pop the last action target
    const targetUserId = current[scope].pop();

    // Persist the change
    await current.save();

    return res.json({
      ok: true,
      rewound: scope,
      targetUserId: String(targetUserId),
      message:
        scope === "likes"
          ? "Last like has been undone."
          : "Last pass has been undone.",
    });
  } catch (err) {
    console.error("[rewind] error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal Server Error",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

// ESM default export (index.js should `import rewindRouter from './routes/rewind.js'`)
export default router;

// CJS fallback for environments that still use require()
try { module.exports = router; } catch {}
// --- REPLACE END ---
