// --- REPLACE START: convert ESM to CommonJS and fix service path; keep logic intact ---
'use strict';

// RewardEngine lives under controllers/services
const { RewardEngine } = require('../controllers/services/RewardEngine.js');

/**
 * Middleware that registers a click event when a referral code is present
 */
async function trackReferralClicks(req, res, next) {
  const code = req.query.ref;
  if (code) {
    try {
      await RewardEngine.registerClick(code, null);
    } catch (err) {
      console.error('Referral click tracking error:', err);
    }
  }
  next();
}

module.exports = { trackReferralClicks };
// --- REPLACE END ---
