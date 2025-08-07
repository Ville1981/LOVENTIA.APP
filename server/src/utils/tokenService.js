// src/utils/tokenService.js
// Utility for JWT generation and verification (access & refresh tokens)

import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_EXPIRES = '15m'; // access tokens valid for 15 minutes
const REFRESH_EXPIRES = '7d'; // refresh tokens valid for 7 days

/**
 * Generate a signed access token for a given payload
 * @param {Object} payload - Data to embed in token (e.g., { id: userId })
 * @returns {string}
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

/**
 * Generate a signed refresh token for a given payload
 * @param {Object} payload
 * @returns {string}
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
}

/**
 * Verify an access token, throws on error
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify a refresh token, throws on error
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}
