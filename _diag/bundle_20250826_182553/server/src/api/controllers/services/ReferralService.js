// --- REPLACE START: convert ESM imports/exports to CommonJS; keep logic intact ---
'use strict';

const { customAlphabet } = require('nanoid');
const Referral = require('../models/Referral.js');

const nanoid = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  8
);

/**
 * Creates a new unique referral link for a specific user.
 * @param {String} userId  The user's DB ID
 * @returns {Promise<Object>} The created referral document
 */
async function createReferralLink(userId) {
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
 * Fetches referral statistics by referral code.
 * @param {String} code  Referral code
 * @returns {Promise<Object|null>} Stats { code, clicks, signups } or null if not found
 */
async function getReferralByCode(code) {
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
 * Lists all referral links and their stats for the given user.
 * @param {String} userId  The user's DB ID
 * @returns {Promise<Array>} List of referral objects
 */
async function listUserReferrals(userId) {
  const referrals = await Referral.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();
  return referrals.map((r) => ({
    code: r.code,
    clicks: r.clicks,
    signups: r.signups,
    createdAt: r.createdAt,
  }));
}

module.exports = {
  createReferralLink,
  getReferralByCode,
  listUserReferrals,
};
// --- REPLACE END ---
