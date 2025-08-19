// server/controllers/userController.js

// --- REPLACE START: controller with real forgot/reset password flow + email sending ---
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Models (direct access only where needed; services handle most logic)
import * as UserModule from '../models/User.js';
const User = UserModule?.default || UserModule;

// Inline refresh cookie options (no external utils dependency)
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Returns the first defined value from the provided arguments.
 * Used to keep backward-compat with multiple env var names.
 */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

/**
 * Lazy service loader – tolerates different folder layouts.
 * Tries several base paths; caches the first set it finds.
 */
let _servicesCache = null;
async function loadServices() {
  if (_servicesCache) return _servicesCache;

  const bases = ['../services', './services', '../api/services', '../src/services'];
  const result = {};
  for (const base of bases) {
    try {
      // auth.service
      if (!result.registerUserService || !result.loginUserService) {
        const authMod = await import(new URL(`${base}/auth.service.js`, import.meta.url)).catch(() => null);
        if (authMod) {
          result.registerUserService = authMod.registerUserService || authMod.default?.registerUserService;
          result.loginUserService    = authMod.loginUserService    || authMod.default?.loginUserService;
        }
      }
      // profile.service
      if (!result.getMeService || !result.updateProfileService || !result.getMatchesWithScoreService || !result.upgradeToPremiumService) {
        const profMod = await import(new URL(`${base}/profile.service.js`, import.meta.url)).catch(() => null);
        if (profMod) {
          result.getMeService               = profMod.getMeService               || profMod.default?.getMeService;
          result.updateProfileService       = profMod.updateProfileService       || profMod.default?.updateProfileService;
          result.getMatchesWithScoreService = profMod.getMatchesWithScoreService || profMod.default?.getMatchesWithScoreService;
          result.upgradeToPremiumService    = profMod.upgradeToPremiumService    || profMod.default?.upgradeToPremiumService;
        }
      }
      // images.service
      if (!result.uploadExtraPhotosService || !result.uploadPhotoStepService || !result.deletePhotoSlotService) {
        const imgMod = await import(new URL(`${base}/images.service.js`, import.meta.url)).catch(() => null);
        if (imgMod) {
          result.uploadExtraPhotosService = imgMod.uploadExtraPhotosService || imgMod.default?.uploadExtraPhotosService;
          result.uploadPhotoStepService   = imgMod.uploadPhotoStepService   || imgMod.default?.uploadPhotoStepService;
          result.deletePhotoSlotService   = imgMod.deletePhotoSlotService   || imgMod.default?.deletePhotoSlotService;
        }
      }
    } catch {
      /* continue trying other bases */
    }
  }

  _servicesCache = result;
  return result;
}

/** helpers **/
function removeFileSafe(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    const absolute = path.resolve(filePath);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('removeFileSafe warning:', e?.message || e);
  }
}

function buildJwtPayload(user) {
  return { id: String(user._id), role: user.role || 'user' };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Nodemailer transporter (config via env)
────────────────────────────────────────────────────────────────────────────── */
function buildTransporter() {
  const host   = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port   = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!user || !pass) {
    // eslint-disable-next-line no-console
    console.warn('[mail] SMTP_USER/SMTP_PASS missing. Emails will fail.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

async function sendMail({ to, subject, text, html }) {
  const transporter = buildTransporter();
  const from = process.env.MAIL_FROM || `No-Reply <no-reply@localhost>`;
  return transporter.sendMail({ from, to, subject, text, html });
}

/* ──────────────────────────────────────────────────────────────────────────────
   Auth / Account
────────────────────────────────────────────────────────────────────────────── */

export async function registerUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.registerUserService === 'function') {
    return sv.registerUserService(req, res);
  }
  // Fallback implementation
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }

    const normEmail = String(email).toLowerCase().trim();
    const normUsername = String(username).trim();

    const existing = await User.findOne({ $or: [{ email: normEmail }, { username: normUsername }] });
    if (existing) {
      // Handle duplicates gracefully
      const field = existing.email === normEmail ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} already in use.` });
    }

    const saltRounds = parseInt(process.env.SALT_ROUNDS || '10', 10);
    const hashed = await bcrypt.hash(password, saltRounds);
    const user = await User.create({ email: normEmail, password: hashed, username: normUsername });

    return res.status(201).json({ user: { id: user._id, email: user.email, username: user.username } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('registerUser fallback error:', err);
    // E11000 duplicate key fallback
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${key} already in use.` });
    }
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

export async function loginUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.loginUserService === 'function') {
    return sv.loginUserService(req, res, { refreshCookieOptions });
  }
  // Fallback implementation
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, user.password || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const payload = buildJwtPayload(user);

    // Support both JWT_SECRET and ACCESS_TOKEN_SECRET (whichever is set)
    const accessSecret = pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET) || 'dev_jwt_secret';
    const refreshSecret = pickFirstDefined(process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_SECRET) || 'dev_refresh_secret';

    const accessToken = jwt.sign(payload, accessSecret, { expiresIn: process.env.ACCESS_TOKEN_TTL || '15m' });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: process.env.REFRESH_TOKEN_TTL || '7d' });

    if (typeof res.cookie === 'function') {
      res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    }
    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, username: user.username, role: user.role || 'user' },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('loginUser fallback error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Password reset: forgot + reset (real email sending)
────────────────────────────────────────────────────────────────────────────── */

// --- REPLACE START: real forgot-password (creates token, emails link) ---
export async function forgotPassword(req, res) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email });
    // Always respond with success to avoid account enumeration
    const genericResponse = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Generate a secure random token (send raw token by email, store hash in DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Save hash + expiry to user document (works even if schema doesn't predefine fields)
    const ttlMinutes = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10); // default 30min
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await user.save();

    // Build reset link to frontend
    const appName = process.env.APP_NAME || 'Loventia';
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5174';
    const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

    // Send email
    const subject = `${appName} password reset`;
    const text = `You requested a password reset.\n\nClick the link to set a new password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
    const html = `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    try {
      await sendMail({ to: email, subject, text, html });
    } catch (mailErr) {
      // eslint-disable-next-line no-console
      console.error('[mail] Failed to send reset email:', mailErr?.message || mailErr);
      // Fail gracefully but keep generic response (token is stored; user can try again)
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('forgotPassword error:', err);
    return res.status(500).json({ error: 'Failed to process request.' });
  }
}
// --- REPLACE END ---

// --- REPLACE START: reset-password (verifies token, sets new password) ---
export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const now = new Date();

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: now },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    const saltRounds = parseInt(process.env.SALT_ROUNDS || '10', 10);
    user.password = await bcrypt.hash(password, saltRounds);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Optional: clear refresh cookie after password change
    try {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('refreshToken', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    } catch {
      /* noop */
    }

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Profile
────────────────────────────────────────────────────────────────────────────── */

export async function getMe(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMeService === 'function') {
    return sv.getMeService(req, res);
  }
  // Fallback implementation
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await User.findById(String(id)).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMe fallback error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function updateProfile(req, res) {
  const sv = await loadServices();
  if (typeof sv.updateProfileService === 'function') {
    return sv.updateProfileService(req, res);
  }
  // Minimal fallback: shallow update of allowed fields
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const allowed = [
      'username','email','summary','gender','orientation','goal','lookingFor','age','height','heightUnit',
      'weight','weightUnit','city','region','country','customCity','customRegion','customCountry',
      'profession','professionCategory','education','religion','religionImportance','children','pets',
      'nutritionPreferences','activityLevel','healthInfo','smoke','drink','drugs','latitude','longitude',
      'profilePhoto','extraImages','politicalIdeology','location','name','bodyType','preferredGender',
      'preferredMinAge','preferredMaxAge','preferredInterests','interests','status'
    ];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];

    // map top-level location fields into nested
    patch.location = patch.location || {};
    for (const key of ['country','region','city']) {
      if (req.body && key in req.body) patch.location[key] = req.body[key];
      if (req.body && (`location.${key}`) in req.body) patch.location[key] = req.body[`location.${key}`];
    }

    const user = await User.findById(String(id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    Object.assign(user, patch);
    const saved = await user.save();
    return res.json({ user: saved });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('updateProfile fallback error:', err);
    return res.status(500).json({ error: 'Profile update failed' });
  }
}

export async function upgradeToPremium(req, res) {
  const sv = await loadServices();
  if (typeof sv.upgradeToPremiumService === 'function') {
    return sv.upgradeToPremiumService(req, res);
  }
  return res.status(501).json({ error: 'Not implemented (premium service missing)' });
}

export async function getMatchesWithScore(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMatchesWithScoreService === 'function') {
    return sv.getMatchesWithScoreService(req, res);
  }
  return res.status(501).json({ error: 'Not implemented (matches service missing)' });
}

/**
 * Images
 */
export async function uploadExtraPhotos(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadExtraPhotosService === 'function') {
    return sv.uploadExtraPhotosService(req, res);
  }
  return res.status(501).json({ error: 'Not implemented (images service missing)' });
}

export async function uploadPhotoStep(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadPhotoStepService === 'function') {
    return sv.uploadPhotoStepService(req, res);
  }
  return res.status(501).json({ error: 'Not implemented (images service missing)' });
}

export async function deletePhotoSlot(req, res) {
  const sv = await loadServices();
  if (typeof sv.deletePhotoSlotService === 'function') {
    return sv.deletePhotoSlotService(req, res);
  }
  return res.status(501).json({ error: 'Not implemented (images service missing)' });
}

/* ──────────────────────────────────────────────────────────────────────────────
   Delete my account (cascade) – DELETE /api/users/me
────────────────────────────────────────────────────────────────────────────── */

export async function deleteMeUser(req, res) {
  try {
    const uid =
      req.user?.id || req.user?._id || req.user?.userId || req.auth?.userId || req.auth?.id;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Files cleanup
    let removedFiles = 0;
    try {
      if (user.profilePicture) { removeFileSafe(user.profilePicture); removedFiles += 1; }
      if (Array.isArray(user.extraImages)) {
        for (const p of user.extraImages) { removeFileSafe(p); removedFiles += 1; }
      }
    } catch (e) {
      console.warn('deleteMeUser file cleanup warning:', e?.message || e);
    }

    // Messages cleanup (best-effort)
    let deletedMessages = 0;
    try {
      const MsgModule = await import('../models/Message.js').catch(() => null);
      const Message = MsgModule?.default || MsgModule;
      if (Message && typeof Message.deleteMany === 'function') {
        const r1 = await Message.deleteMany({ sender: String(uid) });
        const r2 = await Message.deleteMany({ receiver: String(uid) });
        const r3 = await Message.deleteMany({ participants: String(uid) }).catch(() => ({ deletedCount: 0 }));
        deletedMessages = (r1?.deletedCount || 0) + (r2?.deletedCount || 0) + (r3?.deletedCount || 0);
      }
    } catch (e) {
      console.warn('deleteMeUser message cleanup skipped:', e?.message || e);
    }

    // Delete user
    await User.findByIdAndDelete(String(uid));

    // Clear refresh cookie if present
    try {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('refreshToken', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    } catch {
      /* noop */
    }

    res.setHeader('X-Removed-Files', String(removedFiles));
    res.setHeader('X-Deleted-Messages', String(deletedMessages));
    return res.status(204).send();
  } catch (err) {
    console.error('deleteMeUser error:', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}

// Default export for easier destructuring in routes
export default {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  upgradeToPremium,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  deleteMeUser,
};
// --- REPLACE END ---

