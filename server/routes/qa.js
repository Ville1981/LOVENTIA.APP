// server/routes/qa.js
// --- REPLACE START: Q&A visibility routes (premium-gated skeleton) ---
'use strict';

const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const User = require('../models/User');

// Helper to check entitlement
function hasFeature(user, feature) {
  try {
    if (!user) return false;
    if (user.isPremium) return true; // legacy shortcut
    return !!(user.entitlements?.features?.[feature]);
  } catch {
    return false;
  }
}

/**
 * GET /api/qa
 * Return Q&A answers of other users.
 * - If premium user (qaVisibilityAll), show all answers.
 * - If free user, return only "public" subset.
 */
router.get('/qa', requireAuth, async (req, res) => {
  try {
    const canSeeAll = hasFeature(req.user, 'qaVisibilityAll');

    // TODO: Replace with actual DB query
    const fakeAnswers = [
      { user: 'Alice', q: 'Do you like dogs?', a: 'Yes!', visibility: 'public' },
      { user: 'Bob', q: 'Do you smoke?', a: 'No', visibility: 'premium' },
    ];

    const visible = canSeeAll
      ? fakeAnswers
      : fakeAnswers.filter((ans) => ans.visibility === 'public');

    return res.json({ answers: visible });
  } catch (err) {
    console.error('[qa] GET error', err);
    res.status(500).json({ error: 'Failed to fetch Q&A answers' });
  }
});

/**
 * POST /api/qa
 * Allows a user to submit their own Q&A answer (always allowed).
 */
router.post('/qa', requireAuth, async (req, res) => {
  try {
    const { question, answer, visibility = 'public' } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'Missing question or answer' });
    }

    // TODO: Persist in DB
    console.log(`[qa] ${req.user._id} answered: ${question} = ${answer} (${visibility})`);

    return res.json({
      success: true,
      entry: {
        user: req.user.username,
        q: question,
        a: answer,
        visibility,
      },
    });
  } catch (err) {
    console.error('[qa] POST error', err);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

module.exports = router;
// --- REPLACE END ---
