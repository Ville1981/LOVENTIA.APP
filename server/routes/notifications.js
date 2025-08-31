// File: server/routes/notifications.js

// --- REPLACE START: Notifications routes (ESM) ---
import express from "express";
import { listMy, markRead } from "../controllers/notificationsController.js";

// Auth middleware – depending on your project, adjust the import path
// This should set req.user = { id / userId / _id } for the current session.
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/notifications
 * Returns the current user's notifications.
 * Query params:
 *   - unread=1 → only unread notifications
 *   - limit, before, sinceId → pagination
 */
router.get("/", authenticate, listMy);

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
router.patch("/:id/read", authenticate, markRead);

export default router;
// --- REPLACE END ---
