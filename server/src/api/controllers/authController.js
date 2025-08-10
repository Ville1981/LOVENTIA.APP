// --- REPLACE START: ESM auth controller with username validation & robust cookieOptions ---
/**
 * Auth Controller (ESM)
 * - Pure ESM (no require)
 * - Uses mongoose.models.User loaded by index.js (fallback dynamic import)
 * - Clear 400 on missing username (instead of Mongoose ValidationError)
 * - Helpers: generateAccessToken / generateRefreshToken
 * - Exports: register, login, refreshToken, logout
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Robust cookieOptions import: named export or default, with sane fallback
let cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
};
try {
  const modURL = pathToFileURL(path.resolve(__dirname, '../../utils/cookieOptions.js'));
  const mod    = await import(modURL.href);
  cookieOptions = mod.cookieOptions || mod.default || cookieOptions;
} catch (_) {
  // keep fallback
}

// Resolve User model primarily from mongoose registry
let User = mongoose.models?.User;
if (!User) {
  // Try common duplicates in repo layout
  const candidatePaths = [
    // ../../../models/User.js relative to this file (server/models/User.js)
    path.resolve(__dirname, '../../../models/User.js'),
    // ../../models/User.js (server/src/models/User.js)
    path.resolve(__dirname, '../../models/User.js'),
  ];
  for (const p of candidatePaths) {
    try {
      const m = await import(pathToFileURL(p).href);
      const candidate = m.default || m.User || m;
      if (candidate?.findOne) {
        User = candidate;
        break;
      }
    } catch {
      // continue
    }
  }
}
if (!User || typeof User.findOne !== 'function') {
  console.error('[authController] User model not usable. Did you import models in index.js?');
}

/* ----------------------- Helpers ----------------------- */
function ensureJwtSecrets() {
  const ok = !!(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
  if (!ok) console.error('[authController] Missing JWT secrets in environment');
  return ok;
}

function normalizeId(user) {
  if (!user) return undefined;
  if (user.id) return user.id;
  if (user._id && typeof user._id.toString === 'function') return user._id.toString();
  return undefined;
}

function generateAccessToken(payload, expiresIn = '15m') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

function generateRefreshToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
}

function safeUsername({ username, name, email }) {
  if (username && typeof username === 'string' && username.trim()) return username.trim();
  if (name && typeof name === 'string' && name.trim()) return name.trim();
  if (email && typeof email === 'string') {
    const base = email.split('@')[0] || 'user';
    return `${base}`.slice(0, 30);
  }
  return '';
}

/* ----------------------- Controllers ----------------------- */
/**
 * POST /api/auth/register
 * Body: { email, password, name?, username? }
 */
export async function register(req, res) {
  try {
    const { email, password } = req.body || {};
    let { name, username } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!User?.findOne) {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    // username requirement (schema requires it) -> explicit 400 instead of Mongoose ValidationError
    username = safeUsername({ username, name, email });
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Duplicate check
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Hash password
    const salt    = await bcrypt.genSalt(10);
    const hashed  = await bcrypt.hash(password, salt);

    // Create user
    const doc = new User({
      email,
      password: hashed,
      name: name || username,
      username,
      role: 'user',
    });
    const user = await doc.save();

    // Tokens
    if (!ensureJwtSecrets()) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const uid   = normalizeId(user);
    const role  = user?.role || 'user';
    const at    = generateAccessToken({ userId: uid, role });
    const rt    = generateRefreshToken({ userId: uid, role });

    // Set refresh cookie
    res.cookie('refreshToken', rt, cookieOptions);

    return res.status(201).json({
      accessToken: at,
      user: { id: uid, email: user.email, name: user.name, username, role },
    });
  } catch (err) {
    console.error('Register error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!User?.findOne) {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    const user = await User.findOne({ email });
    if (!user?.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!ensureJwtSecrets()) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const uid  = normalizeId(user);
    const role = user?.role || 'user';
    const at   = generateAccessToken({ userId: uid, role });
    const rt   = generateRefreshToken({ userId: uid, role });

    res.cookie('refreshToken', rt, cookieOptions);

    return res.json({
      accessToken: at,
      user: { id: uid, email: user.email, name: user.name, username: user.username, role },
    });
  } catch (err) {
    console.error('Login error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server error during login' });
  }
}

/**
 * POST /api/auth/refresh
 * Cookie: refreshToken
 */
export async function refreshToken(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }
    if (!ensureJwtSecrets()) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) return res.status(403).json({ error: 'Invalid refresh token' });

      const at = generateAccessToken({ userId: payload.userId, role: payload.role });

      // refresh rotation (best practice)
      try {
        const rotated = generateRefreshToken({ userId: payload.userId, role: payload.role });
        res.cookie('refreshToken', rotated, cookieOptions);
      } catch (rotErr) {
        console.warn('[authController] Refresh rotation failed:', rotErr?.message || rotErr);
      }

      return res.json({ accessToken: at });
    });
  } catch (err) {
    console.error('Refresh error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server error during refresh' });
  }
}

/**
 * POST /api/auth/logout
 * Clears refreshToken cookie
 */
export function logout(req, res) {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    return res.sendStatus(204);
  } catch (err) {
    console.error('Logout error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Logout failed' });
  }
}
// --- REPLACE END ---
