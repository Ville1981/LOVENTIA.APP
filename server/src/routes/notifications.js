// File: server/src/routes/notifications.js

// --- REPLACE START: ESM notifications router with safe fallbacks ---
import express from "express";

const router = express.Router();

/**
 * GET /
 * Returns notifications for the current user.
 * If controller exists, delegate. Otherwise return empty set.
 */
let listController = null;
async function getListController() {
  if (listController) return listController;
  try {
    const mod = await import("../controllers/notificationController.js");
    listController = (mod.default && mod.default.list) || mod.list || null;
  } catch {
    listController = null;
  }
  return listController;
}

router.get("/", async (req, res, next) => {
  try {
    const handler = await getListController();
    if (typeof handler === "function") return handler(req, res, next);
    return res.json({ notifications: [], unread: 0 });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /read
 * Mark notifications as read. Fallback is a no-op.
 */
let readController = null;
async function getReadController() {
  if (readController) return readController;
  try {
    const mod = await import("../controllers/notificationController.js");
    readController = (mod.default && mod.default.markRead) || mod.markRead || null;
  } catch {
    readController = null;
  }
  return readController;
}

router.post("/read", async (req, res, next) => {
  try {
    const handler = await getReadController();
    if (typeof handler === "function") return handler(req, res, next);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
// --- REPLACE END ---

export default router;
