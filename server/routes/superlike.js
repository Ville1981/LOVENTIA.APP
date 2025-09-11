// File: server/routes/superlike.js

// --- REPLACE START: Super Like routes ---
'use strict';

import express from 'express';
import authenticate from '../middleware/authenticate.js';
import User from '../models/User.js';
import { canSendSuperLike, recordSuperLike } from '../services/superlike.js';

const router = express.Router();

/**
 * POST /api/superlike/:targetId
 * Send a Super Like to another user.
 */
router.post('/:targetId', authenticate, async (req, res) => {
  try {
    const senderId = req.userId;
    const targetId = req.params.targetId;

    if (!senderId || !targetId) {
      return res.status(400).json({ error: 'Missing sender or target user id' });
    }
    if (senderId === targetId) {
      return res.status(400).json({ error: 'Cannot Super Like yourself' });
    }

    const sender = await User.findById(senderId);
    const target = await User.findById(targetId);

    if (!sender || !target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check quota
    if (!canSendSuperLike(sender)) {
      return res.status(403).json({ error: 'Super Like quota reached for this week' });
    }

    // Record usage
    await recordSuperLike(sender);

    // Save Super Like to target user
    if (!Array.isArray(target.superLikes)) {
      target.superLikes = [];
    }
    if (!target.superLikes.includes(sender._id)) {
      target.superLikes.push(sender._id);
      await target.save();
    }

    return res.json({ ok: true, message: 'Super Like sent successfully' });
  } catch (err) {
    console.error('[superlike] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
// --- REPLACE END ---
