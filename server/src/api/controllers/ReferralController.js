// src/api/controllers/ReferralController.js

import {
  createReferralLink,
  getReferralByCode,
  listUserReferrals,
} from '../services/ReferralService.js';

/**
 * Luo uuden referral-linkin nykyiselle käyttäjälle.
 */
export async function createReferral(req, res, next) {
  try {
    const userId = req.user.id;
    const referral = await createReferralLink(userId);
    res.status(201).json({ success: true, referral });
  } catch (err) {
    next(err);
  }
}

/**
 * Hakee referral-statuksen referral-koodilla (esim. klikit, aktivoinnit).
 */
export async function getReferralStatus(req, res, next) {
  try {
    const { code } = req.params;
    const stats = await getReferralByCode(code);
    if (!stats) {
      return res.status(404).json({ success: false, message: 'Referral code not found' });
    }
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

/**
 * Listaa kaikki referral-linkit ja niiden tilastot kirjautuneelle käyttäjälle.
 */
export async function listReferrals(req, res, next) {
  try {
    const userId = req.user.id;
    const referrals = await listUserReferrals(userId);
    res.json({ success: true, referrals });
  } catch (err) {
    next(err);
  }
}
