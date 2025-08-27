// File: server/src/utils/tokenService.js

// --- REPLACE START: convert to CommonJS and support both env var name styles ---
const jwt = require('jsonwebtoken');

// Support both naming schemes to avoid env drift across files
const ACCESS_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  'dev_access_secret_change_me';

const REFRESH_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  process.env.JWT_REFRESH_SECRET ||
  'dev_refresh_secret_change_me';

const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_TTL || '7d';

/**
 * Generate a signed access token for a given payload
 * @param {Object} payload - Data to embed in token (e.g., { userId, role })
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

/**
 * Generate a signed refresh token for a given payload
 * @param {Object} payload
 * @returns {string}
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

/**
 * Verify an access token, throws on error
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify a refresh token, throws on error
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
// --- REPLACE END ---
