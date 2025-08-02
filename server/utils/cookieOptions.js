// utils/cookieOptions.js

/**
 * Options for the refreshToken cookie.
 * These ensure the cookie is Secure, HttpOnly, and SameSite=Strict.
 */
module.exports.cookieOptions = {
  // --- REPLACE START: ensure HttpOnly so it's not accessible via JavaScript ---
  httpOnly: true, // Cookie can only be sent via HTTP(S), not JS
  // --- REPLACE END ---

  // --- REPLACE START: secure flag enables sending only over HTTPS in production ---
  secure: process.env.NODE_ENV === 'production',
  // --- REPLACE END ---

  // --- REPLACE START: SameSite=Strict to mitigate CSRF attacks ---
  sameSite: 'Strict',
  // --- REPLACE END ---

  path: '/', // Cookie sent on all paths
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};
