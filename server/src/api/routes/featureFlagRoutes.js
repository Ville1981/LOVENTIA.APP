// src/api/routes/featureFlagRoutes.js

import express from 'express';
import { loadFeatureFlags, isFeatureEnabled } from '../../utils/featureToggle.js';

const router = express.Router();
let currentFlags = {};

// Hae kaikki flagit
router.get('/feature-flags', (req, res) => {
  res.json(currentFlags);
});

// Päivitä flagit
router.post('/feature-flags', (req, res) => {
  currentFlags = req.body;
  loadFeatureFlags(currentFlags);
  res.json({ success: true, flags: currentFlags });
});

// Tarkista yksittäinen
router.get('/feature-flags/:flag', (req, res) => {
  const { flag } = req.params;
  res.json({ flag, enabled: isFeatureEnabled(flag) });
});

export default router;
