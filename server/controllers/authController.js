// controllers/authController.js

import jwt from 'jsonwebtoken';
import { cookieOptions } from '../utils/cookieOptions.js';
import User from '../models/User.js'; // or your own User model

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

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // --- REPLACE START: set secure, HttpOnly, SameSite cookie for refreshToken ---
    res.cookie('refreshToken', refreshToken, cookieOptions);
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
export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.sendStatus(401);
    }

    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
      if (err) {
        return res.sendStatus(403);
      }

      const accessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
      );

      // --- REPLACE START: rotate refreshToken cookie if desired (optional) ---
      // Uncomment below to issue a new refresh token on each refresh.
      // const newRefreshToken = jwt.sign(
      //   { userId: payload.userId },
      //   process.env.REFRESH_TOKEN_SECRET,
      //   { expiresIn: '7d' }
      // );
      // res.cookie('refreshToken', newRefreshToken, cookieOptions);
      // --- REPLACE END ---

      return res.json({ accessToken });
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
  // --- REPLACE START: clear cookie using centralized cookieOptions ---
  res.clearCookie('refreshToken', cookieOptions);
  // --- REPLACE END ---
  return res.sendStatus(204);
};
