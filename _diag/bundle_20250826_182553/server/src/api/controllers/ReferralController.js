// --- REPLACE START: convert ESM imports/exports to CommonJS; keep logic intact ---
'use strict';

const {
  createReferralLink,
  getReferralByCode,
  listUserReferrals,
} = require('../services/ReferralService.js');

/**
 * Creates a new referral link for the current user.
 */
async function createReferral(req, res, next) {
  try {
    const userId = req.user.id;
    const referral = await createReferralLink(userId);
    res.status(201).json({ success: true, referral });
  } catch (err) {
    next(err);
  }
}

/**
 * Fetches referral status by referral code (e.g., clicks, signups).
 */
async function getReferralStatus(req, res, next) {
  try {
    const { code } = req.params;
    const stats = await getReferralByCode(code);
    if (!stats) {
      return res
        .status(404)
        .json({ success: false, message: 'Referral code not found' });
    }
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all referral links and their stats for the authenticated user.
 */
async function listReferrals(req, res, next) {
  try {
    const userId = req.user.id;
    const referrals = await listUserReferrals(userId);
    res.json({ success: true, referrals });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReferral,
  getReferralStatus,
  listReferrals,
};
// --- REPLACE END ---
