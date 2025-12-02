// PATH: server/src/routes/adminPing.js

import express from "express";

const router = express.Router();

/**
 * Simple admin-only health endpoint.
 *
 * Mounted under /api/admin by routes/index.js via useAdmin().
 *
 * Expected behavior:
 * - Without token        → 401 (from authenticate middleware).
 * - With non-admin token → 403 (from useAdmin guard).
 * - With admin/owner/superadmin token → 200 { ok: true, ... }.
 */
router.get("/ping", (req, res) => {
  const user = req.user || {};
  const auth = req.auth || {};

  res.json({
    ok: true,
    ts: new Date().toISOString(),
    info: "admin ping",
    user: {
      id: user._id || user.id || auth.sub || null,
      role: user.role || auth.role || null,
    },
  });
});

export default router;






