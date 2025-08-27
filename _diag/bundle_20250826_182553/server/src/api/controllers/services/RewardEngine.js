// --- REPLACE START: convert ESM imports/exports to CommonJS; keep logic intact ---
'use strict';

const RewardLog = require('../models/RewardLog.js');
const Referral = require('../models/Referral.js');
const ReferralBonus = require('../models/ReferralBonus.js');

class RewardEngine {
  /**
   * Registers a click-type event and increments the click counter.
   */
  static async registerClick(code, userId) {
    const referral = await Referral.findOneAndUpdate(
      { code },
      { $inc: { clicks: 1 } },
      { new: true }
    );
    await RewardLog.create({
      user: userId,
      referralCode: code,
      type: 'click',
      amount: 0,
    });
    return referral;
  }

  /**
   * Registers a signup event, adds a bonus, and records ReferralBonus entries.
   */
  static async registerSignup(code, userId) {
    const referral = await Referral.findOneAndUpdate(
      { code },
      { $inc: { signups: 1 } },
      { new: true }
    );
    const bonusAmount = 10; // e.g., 10 units
    await RewardLog.create({
      user: userId,
      referralCode: code,
      type: 'signup',
      amount: bonusAmount,
    });
    await ReferralBonus.create({
      referral: referral._id,
      user: userId,
      amount: bonusAmount,
      type: 'signup',
    });
    return { referral, bonusAmount };
  }
}

module.exports = { RewardEngine };
// --- REPLACE END ---
