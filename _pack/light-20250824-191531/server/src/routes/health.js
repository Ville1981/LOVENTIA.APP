// server/src/routes/health.js
'use strict';

const express = require('express');
const router = express.Router();

/**
 * Simple health endpoint for liveness/readiness checks.
 * Returns 200 and a small JSON payload.
 * No auth, no rate limit — keep lightweight.
 */
router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'loventia-api',
    time: new Date().toISOString(),
  });
});

// Optional HEAD for ultra-light checks
router.head('/', (_req, res) => {
  res.sendStatus(200);
});

module.exports = router;
