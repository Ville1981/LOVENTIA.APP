// File: server/src/api/routes/referral.js

// --- REPLACE START: minimal referral API (my-code & beacon) ---
import express from 'express';
import { codeFromUserId } from '../../utils/referral.js';

const router = express.Router();

/**
 * GET /api/referral/my-code
 * Returns a deterministic short referral code for the logged-in user.
 * Auth middleware assumed upstream (if you have it as app-level, this is fine).
 */
router.get('/my-code', async (req, res) => {
  try {
    const user = req.user || req.authUser || null; // adapt to your auth attach point
    const userId = user?._id?.toString?.() || user?.id || '';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const code = codeFromUserId(userId);
    return res.json({ code });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to compute referral code.' });
  }
});

/**
 * POST /api/referral/track
 * Optional tiny beacon to log click/impression if you want (no-op if you don’t).
 * Body: { ref, event: 'impression' | 'click' | 'signup' }
 * Currently returns 204 without storing (safe placeholder).
 */
router.post('/track', async (req, res) => {
  // Intentionally no-op to keep this lightweight/minimal & DB-free.
  // You can later persist to a collection: {ref, event, ts, ua, ip}
  return res.sendStatus(204);
});

export default router;
// --- REPLACE END ---
