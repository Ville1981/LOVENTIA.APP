// PATH: server/src/controllers/authController.js

// --- REPLACE START: ESM auth controller with username validation & robust cookieOptions + real forgot/reset password (email) ---
/**
 * Auth Controller (ESM)
 * - Pure ESM (no require)
 * - Uses mongoose.models.User loaded by app bootstrap (fallback dynamic import)
 * - Clear 400 on missing username (instead of Mongoose ValidationError)
 * - Helpers: generateAccessToken / generateRefreshToken
 * - Email reset flow with crypto token (hash stored in DB) + nodemailer
 * - Exports: register, login, refreshToken, logout, me, forgotPassword, resetPassword (+ default export)
 * - Compatibility: reset link now includes ?token=...&id=..., and reset endpoint accepts { token, password } OR { id, token, newPassword }.
 * - Cookie policy: dev → SameSite=Lax, Secure=false, Path=/api/auth; prod → SameSite=Strict (overridable), Secure=true
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Resolve __filename/__dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* -------------------------------------------------------------------------- */
/*                             Cookie configuration                            */
/* -------------------------------------------------------------------------- */
/**
 * We keep a base cookieOptions object that can be overridden by:
 * - local utils/cookieOptions.js (if present)
 * - environment variables (COOKIE_PATH, COOKIE_SAMESITE, COOKIE_SECURE, COOKIE_DOMAIN)
 *
 * Defaults:
 *   - Development (NODE_ENV !== 'production'):
 *       httpOnly = true, sameSite = 'Lax', secure = false, path = '/api/auth'
 *   - Production:
 *       httpOnly = true, sameSite = 'Strict' (unless env override), secure = true, path = '/api/auth'
 *
 * NOTE:
 *   - We DO NOT set domain by default. If you need cross-subdomain cookies in prod,
 *     set COOKIE_DOMAIN=.yourdomain.com in the environment.
 *   - We do NOT fix maxAge here; it is set where cookies are issued.
 */

let cookieOptions = {
  httpOnly: true,
  sameSite: 'Lax',     // dev default (normalized later)
  secure: false,       // dev default
  path: '/api/auth',   // stable path for refresh/login/logout
  // domain: undefined  // only if explicitly provided via env or util override
};

// Optional: load project-specific defaults if provided
try {
  const modURL = pathToFileURL(path.resolve(__dirname, '../../utils/cookieOptions.js'));
  const mod    = await import(modURL.href);
  const fromUtil = mod.cookieOptions || mod.default;
  if (fromUtil && typeof fromUtil === 'object') {
    cookieOptions = { ...cookieOptions, ...fromUtil };
  }
} catch {
  // keep fallback
}

// File: server/src/controllers/authController.js

// Allow environment overrides (string values)
const ENV_SAMESITE = (process.env.COOKIE_SAMESITE || '').trim(); // e.g. 'Lax' | 'Strict' | 'None' (case-insensitive ok)
const ENV_SECURE   = (process.env.COOKIE_SECURE   || '').trim(); // 'true' | 'false'
const ENV_PATH     = (process.env.COOKIE_PATH     || '').trim();
const ENV_DOMAIN   = (process.env.COOKIE_DOMAIN   || '').trim();

if (ENV_PATH)     cookieOptions.path     = ENV_PATH;
if (ENV_SAMESITE) cookieOptions.sameSite = ENV_SAMESITE;
if (ENV_SECURE)   cookieOptions.secure   = ENV_SECURE.toLowerCase() === 'true';
if (ENV_DOMAIN)   cookieOptions.domain   = ENV_DOMAIN;

// Normalize dev/prod defaults if not overridden
if (process.env.NODE_ENV === 'production') {
  // In prod, prefer stricter defaults unless explicitly overridden above/util
  if (!ENV_SECURE && (cookieOptions.secure === false || cookieOptions.secure == null)) {
    cookieOptions.secure = true;
  }
  if (!ENV_SAMESITE && (!cookieOptions.sameSite || String(cookieOptions.sameSite).toLowerCase() === 'lax')) {
    cookieOptions.sameSite = 'Strict';
  }
} else {
  // In dev, force dev-friendly defaults unless explicitly overridden
  if (!ENV_SECURE)   cookieOptions.secure   = false;
  if (!ENV_SAMESITE) cookieOptions.sameSite = 'Lax';
  if (!ENV_PATH)     cookieOptions.path     = '/api/auth';
}

// Ensure proper casing for SameSite accepted by Express/Set-Cookie (case-insensitive allowed, but keep tidy)
const sameSiteLower = String(cookieOptions.sameSite || '').toLowerCase();
if (sameSiteLower === 'lax') cookieOptions.sameSite = 'Lax';
else if (sameSiteLower === 'strict') cookieOptions.sameSite = 'Strict';
else if (sameSiteLower === 'none') cookieOptions.sameSite = 'None';

/* -------------------------------------------------------------------------- */
/*                          Resolve / load the User model                      */
/* -------------------------------------------------------------------------- */

let User = mongoose.models?.User;
if (!User) {
  const candidatePaths = [
    // monorepo /src location → project /models
    path.resolve(__dirname, '../../../models/User.js'),
    // plain /src → /src/models as fallback
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
  console.error('[authController] User model not usable. Ensure models are imported at startup.');
}

/* -------------------------------------------------------------------------- */
/*                                    Utils                                    */
/* -------------------------------------------------------------------------- */

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

// --- REPLACE START: default access token = 2h, refresh token = 30d (env-overridable) ---
/**
 * Token TTLs
 * - JWT_ACCESS_TTL (fallback '2h')
 * - JWT_REFRESH_TTL (fallback '30d')
 *
 * NOTE:
 * Keep these helpers as the *only* place where tokens are signed,
 * so we never accidentally hardcode '15m' elsewhere again.
 */
function generateAccessToken(payload, expiresIn = (process.env.JWT_ACCESS_TTL || '2h')) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn, issuer: tokenIssuer() });
}

function generateRefreshToken(payload, expiresIn = (process.env.JWT_REFRESH_TTL || '30d')) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn, issuer: tokenIssuer() });
}
// --- REPLACE END ---

function isProbablyEmail(str) {
  // lightweight sanity check to avoid pulling extra deps
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || '').trim());
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

function pickClientBaseUrl() {
  const raw =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_CLIENT_BASE_URL ||
    'http://localhost:5174';
  return String(raw).replace(/\/+$/, '');
}

/* ------------------------ Nodemailer (SMTP) helpers ------------------------ */

function buildTransporter() {
  const host   = process.env.SMTP_HOST || 'localhost';
  const port   = Number(process.env.SMTP_PORT || 1025);
  const secure = (process.env.SMTP_SECURE || '').toString().toLowerCase() === 'true' || port === 465;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[authController/mail] SMTP_USER/SMTP_PASS missing. If your SMTP requires auth, emails may fail.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function renderResetEmail({ appName, resetUrl }) {
  const subject = `${appName} password reset`;
  const text =
`You requested a password reset.

Click the link to set a new password:
${resetUrl}

If you didn't request this, you can ignore this email.`;

  const html =
`<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.4;color:#111">
  <h2 style="margin:0 0 12px">${appName} password reset</h2>
  <p>You requested a password reset.</p>
  <p><a href="${resetUrl}" style="display:inline-block;padding:10px 14px;text-decoration:none;border-radius:6px;border:1px solid #222">Click here to set a new password</a></p>
  <p>If you didn’t request this, you can ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
  <p style="font-size:12px;color:#666">This link will expire shortly for your security.</p>
</div>`;

  return { subject, text, html };
}

async function sendMail({ to, subject, text, html }) {
  const transporter = buildTransporter();
  const fromName  = process.env.MAIL_FROM_NAME || 'LoventiaApp';
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@localhost';
  const from = `"${fromName}" <${fromEmail}>`;
  return transporter.sendMail({ from, to, subject, text, html });
}

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                 */
/* -------------------------------------------------------------------------- */

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
    if (!isProbablyEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
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
    if (emailExists)    return res.status(409).json({ message: 'Email already in use' });
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

    // Set refresh cookie (7 days) with stabilized options (dev/prod aware)
    res.cookie('refreshToken', rt, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

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
 * NOTE: Supports legacy plaintext passwords (non-bcrypt) to keep old DBs working.
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

    // --- Legacy-friendly password check (bcrypt OR plaintext) ---
    const stored = String(user.password);
    const looksHashed = /^\$2[aby]\$[0-9]{2}\$/.test(stored);
    let ok = false;

    if (looksHashed) {
      ok = await bcrypt.compare(password, stored);
    } else {
      // plaintext fallback for legacy data
      ok = stored === password;
    }

    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // --- END legacy-friendly check ---

    if (!ensureJwtSecrets()) {
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const uid  = normalizeId(user);
    const role = user?.role || 'user';
    const at   = generateAccessToken({ userId: uid, role });
    const rt   = generateRefreshToken({ userId: uid, role });

    // Set refresh cookie (7 days) with stabilized options (dev/prod aware)
    res.cookie('refreshToken', rt, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

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
 * Accepted:
 *   - Cookie: refreshToken   (preferred)
 *   - Body:   { refreshToken }  (fallback for clients that cannot handle HttpOnly cookies in dev tools)
 * Returns: { accessToken }
 */
export async function refreshToken(req, res) {
  try {
    // Prefer cookie; fall back to explicit body field if present
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
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
        res.cookie('refreshToken', rotated, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
      } catch (rotErr) {
        console.warn('[authController] Refresh rotation failed:', rotErr?.message || rotErr);
      }

      // ✅ Return shape required by frontend: { accessToken }
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
 * Fix Express 5 warning: pass same cookie options to clearCookie as used in cookie()
 */
export function logout(_req, res) {
  try {
    // Include the same options (path/samesite/secure/httpOnly/domain) so the client actually clears it
    res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
    return res.status(200).json({ message: 'Logout successful' });
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

/* ------------------------------- Reset flow ------------------------------- */
/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * - Always return generic success (avoid account enumeration)
 * - If user exists: generate secure token, store hash+expiry, send email with link
 */
export async function forgotPassword(req, res) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!isProbablyEmail(email)) {
      // Still generic response to avoid probing. Only 400 for clearly broken input.
      return res.status(400).json({ error: 'Email format is invalid' });
    }
    if (!User?.findOne) {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    const user = await User.findOne({ email });

    // Generic success to avoid leaking existence
    const okResponse = { message: 'If an account exists for that email, a reset link has been sent.' };
    if (!user) {
      return res.status(200).json(okResponse);
    }

    // Generate token (store hash in DB, email raw token)
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const ttlMin = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);
    const ttlMs = (Number.isFinite(ttlMin) ? ttlMin : 30) * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    // Persist on user (requires fields in schema)
    user.passwordResetToken   = tokenHash;
    user.passwordResetExpires = expiresAt;
    await user.save();

    // Build link (include both token and id for frontend compatibility)
    const clientUrl = pickClientBaseUrl();
    const uid = encodeURIComponent(normalizeId(user) || '');
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}&id=${uid}`;

    // Send email
    const appName = process.env.APP_NAME || 'Loventia';
    const { subject, text, html } = renderResetEmail({ appName, resetUrl });

    try {
      await sendMail({ to: email, subject, text, html });
    } catch (mailErr) {
      console.error('[authController] Failed to send reset email:', mailErr?.message || mailErr);
      // Still return ok response (do not leak details)
    }

    return res.status(200).json(okResponse);
  } catch (err) {
    console.error('forgotPassword error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: EITHER { token, password } OR { id, token, newPassword }
 * - Hash token and find matching non-expired record
 * - Update password, clear reset fields
 */
export async function resetPassword(req, res) {
  try {
    // Accept both shapes for compatibility with existing frontend
    const rawToken = req.body?.token || req.query?.token;
    const providedPassword = req.body?.password ?? req.body?.newPassword;

    if (!rawToken || !providedPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (String(providedPassword).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!User?.findOne) {
      return res.status(500).json({ error: 'Server user model not available' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
    const now = new Date();

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: now },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const salt   = await bcrypt.genSalt(Number.isFinite(saltRounds) ? saltRounds : 10);
    user.password = await bcrypt.hash(providedPassword, salt);

    // Clear reset fields
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Optional: clear refresh cookie after password change (Express 5-safe)
    try {
      res.clearCookie('refreshToken', { ...cookieOptions, maxAge: 0 });
    } catch {
      // noop
    }

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('resetPassword error:', err?.stack || err?.message || err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}

/* ------------------------------ Default export ----------------------------- */

const controller = {
  register,
  login,
  refreshToken,
  logout,
  me,
  forgotPassword,
  resetPassword,
};

export default controller;
// --- REPLACE END ---

