// --- REPLACE START: ESM auth controller with username validation & robust cookieOptions ---
/**
 * Auth Controller (ESM)
 * - Pure ESM (no require)
 * - Uses mongoose.models.User loaded by app bootstrap (fallback dynamic import)
 * - Clear 400 on missing username (instead of Mongoose ValidationError)
 * - Helpers: generateAccessToken / generateRefreshToken
 * - Exports: register, login, refreshToken, logout, me (+ default export)
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve __filename/__dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- cookieOptions (import with safe fallback) ---
let cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
};
try {
  const modURL = pathToFileURL(path.resolve(__dirname, '../../utils/cookieOptions.js'));
  const mod    = await import(modURL.href);
  // allow named or default export; keep fallback if missing
  cookieOptions = mod.cookieOptions || mod.default || cookieOptions;
} catch (_) {
  // keep fallback
}

// In prod, prefer secure cookies automatically if not explicitly overridden
if (process.env.NODE_ENV === 'production') {
  cookieOptions.secure = cookieOptions.secure ?? true;
  cookieOptions.sameSite = cookieOptions.sameSite ?? 'none';
}

// --- Resolve User model from mongoose registry, fallback to common locations ---
let User = mongoose.models?.User;
if (!User) {
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
      // continue trying next candidate
    }
  }
}
if (!User || typeof User.findOne !== 'function') {
  console.error('[authController] User model not usable. Ensure models are imported at startup.');
}

/* ----------------------- Helpers ----------------------- */
function ensureJwtSecrets() {
  const ok = !!(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
  if (!ok) console.error('[authController] Missing JWT secrets in environment');
  return ok;
}
function normalizeId(doc) {
  if (!doc) return undefined;
  if (doc.id) return doc.id;
  if (doc._id && typeof doc._id.toString === 'function') return doc._id.toString();
  return undefined;
}
function tokenIssuer() {
  return process.env.TOKEN_ISSUER || 'loventia-api';
}
function generateAccessToken(payload, expiresIn = (process.env.JWT_ACCESS_TTL || '15m')) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn, issuer: tokenIssuer() });
}
function generateRefreshToken(payload, expiresIn = (process.env.JWT_REFRESH_TTL || '7d')) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn, issuer: tokenIssuer() });
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

    // Explicit username handling (avoid Mongoose ValidationError bubbling)
    username = safeUsername({ username, name, email });
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Duplicate checks
    const [emailExists, usernameExists] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username }),
    ]);
    if (emailExists)   return res.status(409).json({ message: 'Email already in use' });
    if (usernameExists) return res.status(409).json({ message: 'Username already in use' });

    // Hash password
    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const salt   = await bcrypt.genSalt(Number.isFinite(saltRounds) ? saltRounds : 10);
    const hashed = await bcrypt.hash(password, salt);

    // Create user
    const doc = new User({
      email,
      password: hashed,
      name: name || username,
      username,
      role: 'user',
    });
    const user = await doc.save();

    if (!ensureJwtSecrets()) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const uid  = normalizeId(user);
    const role = user?.role || 'user';
    const at   = generateAccessToken({ userId: uid, role });
    const rt   = generateRefreshToken({ userId: uid, role });

    // Set refresh cookie
    res.cookie('refreshToken', rt, cookieOptions);

    return res.status(201).json({
      accessToken: at,
      user: { id: uid, email: user.email, name: user.name, username, role }
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
      user: { id: uid, email: user.email, name: user.name, username: user.username, role }
    });
  } catch (err) {
    console.error('Login error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server error during login' });
  }
}

/**
 * POST /api/auth/refresh
 * Cookie: refreshToken
 * Note: preflight OPTIONS is handled in the route file.
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
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
      }

      const at = generateAccessToken({ userId: payload.userId, role: payload.role });

      // Refresh rotation (best practice): set a new refresh token
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
export function logout(_req, res) {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    return res.sendStatus(204);
  } catch (err) {
    console.error('Logout error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * GET /api/auth/me
 * Requires authenticate middleware to set req.user
 */
export async function me(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!User?.findById) {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('Me route error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/* default export for router compatibility (uses default || named) */
const controller = { register, login, refreshToken, logout, me };
export default controller;
// --- REPLACE END ---
