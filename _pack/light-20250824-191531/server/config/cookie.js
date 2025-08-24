// File: src/config/cookie.js

/**
 * Standardized cookie options for setting HttpOnly cookies.
 * Usage: res.cookie(name, value, cookieOptions)
 */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
};

module.exports = { cookieOptions };
