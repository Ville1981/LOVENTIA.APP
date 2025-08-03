// src/api/services/RewardEngine.js

import RewardLog from '../models/RewardLog.js';
import Referral from '../models/Referral.js';
import ReferralBonus from '../models/ReferralBonus.js';

export class RewardEngine {
  /**
   * Kirjaa click-tyyppisen tapahtuman ja kasvattaa click-laskuria
   */
  static async registerClick(code, userId) {
    const referral = await Referral.findOneAndUpdate(
      { code },
      { $inc: { clicks: 1 } },
      { new: true }
    );
    await RewardLog.create({ user: userId, referralCode: code, type: 'click', amount: 0 });
    return referral;
  }

  /**
   * Kirjaa signup-tapahtuman, lisää bonuksen ja merkitsee RewardBonus-entrien
   */
  static async registerSignup(code, userId) {
    const referral = await Referral.findOneAndUpdate(
      { code },
      { $inc: { signups: 1 } },
      { new: true }
    );
    const bonusAmount = 10; // esim. 10 yksikköä
    await RewardLog.create({ user: userId, referralCode: code, type: 'signup', amount: bonusAmount });
    await ReferralBonus.create({ referral: referral._id, user: userId, amount: bonusAmount, type: 'signup' });
    return { referral, bonusAmount };
  }
}