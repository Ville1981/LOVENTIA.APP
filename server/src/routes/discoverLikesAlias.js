// File: server/src/routes/discoverLikesAlias.js

// --- REPLACE START: delegate internally to likes router instead of 307 redirect ---
"use strict";

import express from "express";
import authenticate from "../middleware/authenticate.js";
// Import the actual likes router so we can dispatch internally
import likesRouter from "./likes.js";

const router = express.Router();

/**
 * Alias endpoint to support legacy/frontend path:
 *   POST /api/discover/:id/like
 *
 * Instead of HTTP redirect (307) — which can drop Authorization in some clients —
 * we internally delegate the request to the likes router. This preserves headers,
 * method, and body without an extra round trip.
 */
router.post("/:id/like", authenticate, (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ ok: false, error: "Missing user id" });
  }
  // Re-route to likes router by rewriting the URL to match "/:id"
  // Keep method/body/headers intact.
  req.url = `/${id}`;
  return likesRouter.handle(req, res, next);
});

export default router;
// --- REPLACE END ---
