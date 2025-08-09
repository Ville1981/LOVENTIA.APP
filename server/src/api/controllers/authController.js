// --- REPLACE START: CommonJS controller with robust CJS/ESM interop and safer auth flow ---
'use strict';

import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import centralized cookie options from src/utils, with safe fallback
let cookieOptions;
try {
  const opts = await import(path.resolve(__dirname, '../../utils/cookieOptions.js'));
  cookieOptions = opts.cookieOptions || opts.default || {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  };
} catch (_) {
  // Sensible dev defaults; adjust for production as needed
  cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  };
}

// --- Robust User model interop (handles CJS `module.exports` and ESM `export default`) ---
let User;
try {
  const maybe = await import(path.resolve(__dirname, '../../../models/User.js'));
  User = maybe.default || maybe;
} catch (e) {
  // Fallback: if already registered in mongoose.models (because models are imported elsewhere)
  User = mongoose.models && mongoose.models.User;
  if (!User) {
    console.error('[authController] Failed to load User model:', e && e.message);
  }
}

// Extra guard: ensure we have a functioning model with `.findOne`
if (!User || typeof User.findOne !== 'function') {
  console.error('[authController] User model not usable. Got:', typeof User);
}

/**
 * POST /api/auth/login
 * Authenticate user and set refreshToken cookie.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!User || typeof User.findOne !== 'function') {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    // 1) Find user by email
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2) Compare password hash
    let passwordsMatch = false;
    try {
      passwordsMatch = await bcrypt.compare(password, user.password);
    } catch (cmpErr) {
      console.error('[authController] bcrypt.compare failed:', cmpErr && cmpErr.message);
    }
    if (!passwordsMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3) Ensure JWT secrets exist
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error('[authController] Missing JWT secrets in environment');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    // 4) Build tokens
    const uid = user.id || (user._id && user._id.toString && user._id.toString());
    const role = user.role || 'user';

    const accessToken = jwt.sign(
      { userId: uid, role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: uid, role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // 5) Set refresh cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // 6) Respond
    return res.json({
      accessToken,
      user: {
        id: uid,
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (err) {
    console.error('Login error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Server error during login' });
  }
}

/**
 * POST /api/auth/refresh
 * Verify refreshToken cookie and issue new accessToken.
 */
export async function refreshToken(req, res, next) {
  try {
    const token = req.cookies && req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error('[authController] Missing JWT secrets in environment');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const newAccessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Optional rotation
      try {
        const rotatedRefresh = jwt.sign(
          { userId: payload.userId, role: payload.role },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
        res.cookie('refreshToken', rotatedRefresh, cookieOptions);
      } catch (rotErr) {
        console.warn('[authController] Refresh rotation failed:', rotErr && rotErr.message);
      }

      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    console.error('Refresh error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Server error during refresh' });
  }
}

/**
 * POST /api/auth/logout
 * Clear refreshToken cookie.
 */
export function logout(req, res) {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    return res.sendStatus(204);
  } catch (err) {
    console.error('Logout error:', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Logout failed' });
  }
}

// --- REPLACE END ---
