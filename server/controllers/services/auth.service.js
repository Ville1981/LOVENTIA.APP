// PATH: server/services/auth.service.js

// --- REPLACE START: auth service (register/login + refresh/me, converted to ESM) ---

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import UserModule from '../../src/models/User.js';
const User = UserModule.default || UserModule;

/**
 * Service: register a new user (validation + password hashing)
 */
export async function registerUserService(req, res) {
  const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Username, email and password are required' });
  }

  try {
    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    if (await User.exists({ username })) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
}

/**
 * Service: login user (verify credentials, issue tokens, set refresh cookie)
 */
export async function loginUserService(req, res, { refreshCookieOptions }) {
  const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
  const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error('JWT secrets not defined');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { userId: user._id.toString(), role: user.role };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES,
    });

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    return res.json({
      accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isPremium: Boolean(user.isPremium),
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
}

/**
 * Service: refresh access token
 */
export async function refreshService(req, res, { refreshCookieOptions }) {
  const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
  const tokenFromCookie = req.cookies?.refreshToken;
  const tokenFromBody = req.body?.refreshToken;
  const refreshToken = tokenFromCookie || tokenFromBody;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const payload = { userId: decoded.userId, role: decoded.role };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    const newRefreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    });
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

/**
 * Service: return current logged-in user ("me")
 */
export async function meService(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- REPLACE END ---
