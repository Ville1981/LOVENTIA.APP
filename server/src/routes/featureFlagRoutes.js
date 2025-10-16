// --- REPLACE START: convert ESM import/export to CommonJS; keep logic intact ---
'use strict';

const express = require('express');
const { loadFeatureFlags, isFeatureEnabled } = require('../../utils/featureToggle.js');

const router = express.Router();
let currentFlags = {};

/**
 * Get all feature flags
 */
router.get('/feature-flags', (req, res) => {
  res.json(currentFlags);
});

/**
 * Update feature flags
 */
router.post('/feature-flags', (req, res) => {
  currentFlags = req.body;
  loadFeatureFlags(currentFlags);
  res.json({ success: true, flags: currentFlags });
});

/**
 * Check a single flag
 */
router.get('/feature-flags/:flag', (req, res) => {
  const { flag } = req.params;
  res.json({ flag, enabled: isFeatureEnabled(flag) });
});

module.exports = router;
// --- REPLACE END ---
