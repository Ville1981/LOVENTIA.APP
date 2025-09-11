// File: server/services/superlike.js

// --- REPLACE START: Super Like service (with premium exception & weekly quota) ---
'use strict';

import User from '../models/User.js';

/**
 * Calculate ISO week key (e.g. "2025-W36").
 * Used to reset quotas every new week.
 */
export function getCurrentWeekKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 1));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + (4 - firstThursday.getUTCDay() + 7) % 7);
  const weekNo = Math.ceil(((now - firstThursday) / 86400000 + firstThursday.getUTCDay() + 1) / 7);
  return `${year}-W${weekNo}`;
}

/**
 * Can this user send a Super Like?
 * - Premium users: unlimited
 * - Free users: max 3 per week
 */
export function canSendSuperLike(user) {
  if (!user) return false;
  if (user.isPremium || user.premium || (user.entitlements?.tier === 'premium')) {
    return true; // unlimited for premium
  }

  const weekKey = getCurrentWeekKey();
  const quota = user.entitlements?.quotas?.superLikes || {};
  if (quota.window !== weekKey) return true; // new week = reset
  return (quota.used || 0) < 3;
}

/**
 * Record that user sent a Super Like.
 * - Increments counter for current week (free users)
 * - Premium users: counter not enforced, but still updated for stats
 */
export async function recordSuperLike(user) {
  if (!user) return false;

  const weekKey = getCurrentWeekKey();
  if (!user.entitlements) user.entitlements = {};
  if (!user.entitlements.quotas) user.entitlements.quotas = {};
  if (!user.entitlements.quotas.superLikes) {
    user.entitlements.quotas.superLikes = { used: 0, window: weekKey };
  }

  const quota = user.entitlements.quotas.superLikes;
  if (quota.window !== weekKey) {
    quota.window = weekKey;
    quota.used = 0;
  }

  quota.used += 1;
  await user.save();

  return true;
}
// --- REPLACE END ---
