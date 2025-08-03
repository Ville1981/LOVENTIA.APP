// utils/cookieOptions.js

// --- REPLACE START: define and export cookieOptions as named ESM export ---
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
// --- REPLACE END ---
