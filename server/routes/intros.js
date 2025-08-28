// File: server/routes/intros.js
// --- REPLACE START: ESM intros routes (premium-gated skeleton) ---
'use strict';

import express from 'express';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// Small helper: check entitlement
function hasFeature(user, feature) {
  try {
    if (!user) return false;
    if (user.isPremium || user.premium) return true; // legacy shortcut
    return !!(user.entitlements?.features?.[feature]);
  } catch {
    return false;
  }
}

// GET /api/intros
router.get('/intros', authenticate, async (req, res) => {
  try {
    if (!hasFeature(req.user, 'introsMessaging')) {
      return res.status(403).json({ error: 'Premium required for introsMessaging' });
    }

    // TODO: fetch intros from DB (stub for now)
    const fakeIntros = [
      {
        _id: 'intro_demo1',
        fromUser: { username: 'Alice' },
        message: 'Hi, saw your profile!',
      },
      {
        _id: 'intro_demo2',
        fromUser: { username: 'Bob' },
        message: 'Would you like to chat?',
      },
    ];

    return res.json(fakeIntros);
  } catch (err) {
    console.error('[intros] GET error', err);
    res.status(500).json({ error: 'Failed to fetch intros' });
  }
});

// POST /api/intros/start
router.post('/intros/start', authenticate, async (req, res) => {
  try {
    if (!hasFeature(req.user, 'introsMessaging')) {
      return res.status(403).json({ error: 'Premium required for introsMessaging' });
    }

    const { targetUserId, message } = req.body || {};
    if (!targetUserId) {
      return res.status(400).json({ error: 'Missing targetUserId' });
    }

    // TODO: persist in DB
    console.log(`[intros] ${req.user._id} started intro to ${targetUserId}: ${message}`);

    return res.json({
      success: true,
      intro: {
        _id: 'intro_new_demo',
        fromUser: { username: req.user.username },
        toUserId: targetUserId,
        message: message || '👋 Hi!',
      },
    });
  } catch (err) {
    console.error('[intros] POST error', err);
    res.status(500).json({ error: 'Failed to start intro' });
  }
});

export default router;
// --- REPLACE END ---
