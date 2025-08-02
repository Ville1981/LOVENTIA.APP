// src/api/utils/TrackingMiddleware.js

import { RewardEngine } from '../services/RewardEngine.js';

/**
 * Middleware, joka rekisteröi click-tapahtuman kun referral-koodilla päästään sivulle
 */
export async function trackReferralClicks(req, res, next) {
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
