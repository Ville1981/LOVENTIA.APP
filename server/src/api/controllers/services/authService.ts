// --- REPLACE START: standalone backend auth service (CommonJS, no frontend imports) ---
'use strict';

const jwt = require('jsonwebtoken');

/* =========================
 * Environment configuration
 * ========================= */
const {
  JWT_ACCESS_SECRET = 'dev_access_secret_change_me',
  JWT_REFRESH_SECRET = 'dev_refresh_secret_change_me',
  ACCESS_TOKEN_EXPIRES_IN = '15m',
  REFRESH_TOKEN_EXPIRES_IN = '30d',
  NODE_ENV = 'development',
  COOKIE_DOMAIN, // optional
} = process.env;

const isProd = NODE_ENV === 'production';

/* =========================
 * Cookie options
 * ========================= */
const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
};

/* =========================
 * Token helpers (JWT)
 * ========================= */
function signAccessToken(userId) {
  const payload = { sub: userId };
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(userId) {
  const payload = { sub: userId };
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (!decoded || !decoded.sub) {
    throw new Error('Invalid refresh token payload');
  }
  return { sub: String(decoded.sub) };
}

/* =========================
 * Cookie utilities
 * ========================= */
function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...refreshCookieOptions,
    maxAge: 0,
  });
}

function readRefreshCookie(req) {
  return (req.cookies && req.cookies[REFRESH_COOKIE_NAME]) || null;
}

/* ==========================================
 * DB/User helpers (replace with your own DB)
 * ========================================== */
async function getUserById(userId) {
  // TODO: Replace with real DB lookup
  return { id: userId, email: 'placeholder@example.com', name: 'User' };
}

async function validateUserCredentials(email, password) {
  // TODO: Replace with real validation logic
  return { id: 'user123', email, name: 'Test User' };
}

/* =========================
 * High-level auth operations
 * ========================= */
async function issueTokensForUser(res, userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

async function handleLogin(res, userId) {
  return issueTokensForUser(res, userId);
}

async function handleRefresh(req, res) {
  const tokenFromCookie = readRefreshCookie(req);
  if (!tokenFromCookie) {
    throw new Error('Missing refresh token');
  }
  const { sub: userId } = verifyRefreshToken(tokenFromCookie);
  const newRefresh = signRefreshToken(userId);
  setRefreshCookie(res, newRefresh);
  const accessToken = signAccessToken(userId);
  return { accessToken };
}

async function handleLogout(res) {
  clearRefreshCookie(res);
  return { ok: true };
}

async function getMe(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

module.exports = {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
  validateUserCredentials,
  issueTokensForUser,
  handleLogin,
  handleRefresh,
  handleLogout,
  getMe,
};
// --- REPLACE END ---
