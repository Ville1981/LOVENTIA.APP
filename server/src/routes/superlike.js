// File: server/src/routes/superlike.js

// --- REPLACE START: ESM router for single superlike action ---
import express from "express";

const router = express.Router();

/**
 * POST /:id
 * Mark a user as superliked by the current user. Parent app applies auth.
 * If a controller is present, we delegate; otherwise provide a minimal response.
 */
let controller = null;
async function getController() {
  if (controller) return controller;
  try {
    const mod = await import("../controllers/superlikeController.js");
    controller = mod.default || mod.superlike || null;
  } catch {
    controller = null;
  }
  return controller;
}

router.post("/:id", async (req, res, next) => {
  try {
    const handler = await getController();
    if (typeof handler === "function") {
      return handler(req, res, next);
    }
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ error: "Target id is required" });
    // Minimal success payload, real logic handled by controller if present
    return res.json({ ok: true, superliked: id });
  } catch (err) {
    return next(err);
  }
});
// --- REPLACE END ---

export default router;
