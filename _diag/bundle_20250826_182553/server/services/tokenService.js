// services/tokenService.js

import RefreshToken from '../models/RefreshToken.js';

/**
 * Save a new refresh token record for a user
 * @param {string} userId - ID of the user
 * @param {string} token - JWT refresh token
 * @returns {Promise<RefreshToken>}
 */
export async function saveRefreshToken(userId, token) {
  try {
    const record = await RefreshToken.create({ userId, token, createdAt: new Date() });
    return record;
  } catch (err) {
    throw new Error(`Failed to save refresh token: ${err.message}`);
  }
}

/**
 * Find an existing refresh token record for a user
 * @param {string} userId - ID of the user
 * @param {string} token - JWT refresh token to find
 * @returns {Promise<RefreshToken|null>}
 */
export async function findRefreshToken(userId, token) {
  try {
    const record = await RefreshToken.findOne({ userId, token });
    return record;
  } catch (err) {
    throw new Error(`Failed to find refresh token: ${err.message}`);
  }
}

/**
 * Revoke (delete) a refresh token record for a user
 * @param {string} userId - ID of the user
 * @param {string} token - JWT refresh token to revoke
 * @returns {Promise<{deletedCount: number}>}
 */
export async function revokeRefreshToken(userId, token) {
  try {
    const result = await RefreshToken.deleteOne({ userId, token });
    return result;
  } catch (err) {
    throw new Error(`Failed to revoke refresh token: ${err.message}`);
  }
}
