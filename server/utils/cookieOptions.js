// server/src/utils/cookieOptions.js

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END

// --- REPLACE START: define and export cookieOptions as named ESM export ---
/**
 * Centralized cookie options for refresh token cookies.
 * - httpOnly: not accessible via JS
 * - secure: only sent over HTTPS in production
 * - sameSite: lax to allow top-level navigation
 * - maxAge: 7 days in milliseconds
 */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
// --- REPLACE END ---
