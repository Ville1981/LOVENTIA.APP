// src/api/services/ReferralService.js

import { customAlphabet } from 'nanoid';
import Referral from '../models/Referral.js';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);

/**
 * Luo uuden uniikin referral-linkin tietylle käyttäjälle.
 * @param {String} userId  Käyttäjän DB:n ID
 * @returns {Promise<Object>} Luotu referral-dokumentti
 */
export async function createReferralLink(userId) {
  const code = nanoid();
  const referral = await Referral.create({
    user: userId,
    code,
    clicks: 0,
    signups: 0,
    createdAt: new Date(),
  });
  return referral;
}

/**
 * Hakee referral-statistiikat koodin perusteella.
 * @param {String} code  Referral-koodi
 * @returns {Promise<Object|null>} Tilastot { code, clicks, signups } tai null jos ei löydy
 */
export async function getReferralByCode(code) {
  const referral = await Referral.findOne({ code }).lean();
  if (!referral) return null;

  return {
    code: referral.code,
    clicks: referral.clicks,
    signups: referral.signups,
    createdAt: referral.createdAt,
  };
}

/**
 * Listaa kaikki referral-linkit ja niiden tilastot kyseiselle käyttäjälle.
 * @param {String} userId  Käyttäjän DB:n ID
 * @returns {Promise<Array>} Referral-objektien lista
 */
export async function listUserReferrals(userId) {
  const referrals = await Referral.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();
  return referrals.map(r => ({
    code: r.code,
    clicks: r.clicks,
    signups: r.signups,
    createdAt: r.createdAt,
  }));
}
