// server/src/controllers/authController.js

import jwt from 'jsonwebtoken';
import { cookieOptions } from '../utils/cookieOptions.js';
import User from '../models/User.js'; // Replace with your actual User model

/**
 * POST /api/auth/login
 * Authenticate user and set refreshToken cookie.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate short-lived access token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    // Generate longer-lived refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // --- REPLACE START: set secure, HttpOnly, SameSite=None cookie for refreshToken ---
    // Ensures the cookie is stored by the browser and sent on subsequent requests.
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      httpOnly: true,                             // inaccessible to JS
      sameSite: 'None',                           // allow cross-site usage
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    });
    // --- REPLACE END ---

    return res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Verify refreshToken cookie and issue new accessToken.
 */
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Issue new access token
      const newAccessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      );

      // --- REPLACE START: (optional) rotate refreshToken cookie ---
      // If you want to refresh the refresh-token on each call, uncomment:
      // const newRefreshToken = jwt.sign(
      //   { userId: payload.userId },
      //   process.env.REFRESH_TOKEN_SECRET,
      //   { expiresIn: '7d' }
      // );
      // res.cookie('refreshToken', newRefreshToken, {
      //   ...cookieOptions,
      //   httpOnly: true,
      //   sameSite: 'None',
      //   secure: process.env.NODE_ENV === 'production',
      // });
      // --- REPLACE END ---

      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Clear refreshToken cookie.
 */
export const logout = (req, res) => {
  // --- REPLACE START: clear refreshToken cookie using centralized cookieOptions ---
  res.clearCookie('refreshToken', {
    ...cookieOptions,
    httpOnly: true,
    sameSite: 'None',
    secure: process.env.NODE_ENV === 'production',
  });
  // --- REPLACE END ---

  return res.sendStatus(204);
};
