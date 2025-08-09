// --- REPLACE START: convert ESM to CommonJS and fix auth path; keep logic intact ---
'use strict';

const express = require('express');
const {
  createReferral,
  getReferralStatus,
  listReferrals,
} = require('../controllers/ReferralController.js');
// Use the centralized authenticate middleware under server/src/middleware
const authenticate = require('../../middleware/authenticate.js');

const router = express.Router();

/**
 * Create a new referral link for the current user
 */
router.post('/referral', authenticate, createReferral);

/**
 * Get referral status by referral code
 */
router.get('/referral/:code', getReferralStatus);

/**
 * List all referral links for the authenticated user
 */
router.get('/referrals', authenticate, listReferrals);

module.exports = router;
// --- REPLACE END ---
