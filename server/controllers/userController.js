// PATH: server/controllers/userController.js

// --- REPLACE START: controller with real forgot/reset password flow + email sending + hide/unhide support (keeps structure & length close to original) ---
/**
 * User Controller
 * -----------------------------------------------------------------------------
 * This controller intentionally keeps a similar structure and length to the
 * original file while adding the requested updates:
 *   - Real forgot/reset password flow with secure token + email sending
 *   - loginUser: auto-unhide on login (time based or resumeOnLogin flag)
 *   - updateProfile allows hidden / hiddenUntil / resumeOnLogin fields
 *   - New hide/unhide endpoints (setVisibilityMe, hideMe, unhideMe)
 *   - Minimal changes elsewhere; comments in English; spelling reviewed
 *
 * Notes:
 * - We keep lazy-loading for services to support multiple folder layouts.
 * - We preserve exports so routes using this file continue to work.
 * - Replacement regions are clearly marked with // --- REPLACE START/END ---
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Models (direct access only where needed; majority of business logic can live in services)
import * as UserModule from '../models/User.js';
const User = UserModule?.default || UserModule;

/* -----------------------------------------------------------------------------
 * Cookie options for refresh token (kept inline to avoid external deps)
 * --------------------------------------------------------------------------- */
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
 * Example: pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET)
 */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

/**
 * Lazy service loader – tolerates different folder layouts.
 * Tries several base paths; caches the first set it finds.
 * This keeps parity with the original approach while avoiding hard failures
 * if a particular service module path doesn’t exist in a given deployment.
 */
let _servicesCache = null;
/** @returns {Promise<Record<string, Function>>} */
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
      if (
        !result.getMeService ||
        !result.updateProfileService ||
        !result.getMatchesWithScoreService ||
        !result.upgradeToPremiumService
      ) {
        const profMod = await import(new URL(`${base}/profile.service.js`, import.meta.url)).catch(() => null);
        if (profMod) {
          result.getMeService               = profMod.getMeService               || profMod.default?.getMeService;
          result.updateProfileService       = profMod.updateProfileService       || profMod.default?.updateProfileService;
          result.getMatchesWithScoreService = profMod.getMatchesWithScoreService || profMod.default?.getMatchesWithScoreService;
          result.upgradeToPremiumService    = profMod.upgradeToPremiumService    || profMod.default?.upgradeToPremiumService;
        }
      }
      // images.service
      if (
        !result.uploadExtraPhotosService ||
        !result.uploadPhotoStepService ||
        !result.deletePhotoSlotService
      ) {
        const imgMod = await import(new URL(`${base}/images.service.js`, import.meta.url)).catch(() => null);
        if (imgMod) {
          result.uploadExtraPhotosService = imgMod.uploadExtraPhotosService || imgMod.default?.uploadExtraPhotosService;
          result.uploadPhotoStepService   = imgMod.uploadPhotoStepService   || imgMod.default?.uploadPhotoStepService;
          result.deletePhotoSlotService   = imgMod.deletePhotoSlotService   || imgMod.default?.deletePhotoSlotService;
        }
      }
    } catch {
      // Keep trying other bases, do not break the app if one fails
    }
  }

  _servicesCache = result;
  return result;
}

/** helpers **/
/**
 * Remove file from disk safely (no-throw).
 * This mirrors behavior in the original controller for cleaning-up assets.
 */
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

/**
 * Build a compact JWT payload using user Mongo id and role.
 * Kept small to minimize token size while preserving role-based auth.
 */
function buildJwtPayload(user) {
  return { id: String(user._id), role: user.role || 'user' };
}

/* -----------------------------------------------------------------------------
 * Nodemailer transporter (config via env)
 * --------------------------------------------------------------------------- */
function buildTransporter() {
  const host   = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port   = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!user || !pass) {
    // eslint-disable-next-line no-console
    console.warn('[mail] SMTP_USER/SMTP_PASS missing. Emails will fail in production.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Send an email using the transporter with a sensible default From header.
 * @param {{to:string, subject:string, text?:string, html?:string}} param0
 */
async function sendMail({ to, subject, text, html }) {
  const transporter = buildTransporter();
  const from = process.env.MAIL_FROM || `No-Reply <no-reply@localhost>`;
  return transporter.sendMail({ from, to, subject, text, html });
}

// --- REPLACE START: outbound normalizer (slash normalization + photos/extraImages mirroring) ---
function toWebPath(p) {
  if (!p || typeof p !== 'string') return p;
  let s = p.replace(/\\/g, '/');
  if (!s.startsWith('/')) s = `/${s}`;
  return s;
}
function normalizeUserOut(u) {
  if (!u) return u;
  const plain = typeof u.toObject === 'function' ? u.toObject() : { ...u };

  const photosIn = Array.isArray(plain.photos) ? plain.photos : null;
  const extraIn  = Array.isArray(plain.extraImages) ? plain.extraImages : null;

  let canonical = photosIn || extraIn || [];
  if (photosIn && extraIn && extraIn.length > photosIn.length) canonical = extraIn;

  const normalizedList = (canonical || []).filter(Boolean).map(toWebPath);
  plain.photos = normalizedList;
  plain.extraImages = normalizedList;

  if (plain.profilePicture) plain.profilePicture = toWebPath(plain.profilePicture);
  if (plain.profilePhoto)   plain.profilePhoto   = toWebPath(plain.profilePhoto);

  return plain;
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Auth / Account
────────────────────────────────────────────────────────────────────────────── */

/**
 * Register user
 * Delegates to service if available; otherwise provides a safe fallback.
 */
export async function registerUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.registerUserService === 'function') {
    return sv.registerUserService(req, res);
  }
  // Fallback implementation (kept close to original behavior)
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }

    const normEmail = String(email).toLowerCase().trim();
    const normUsername = String(username).trim();

    const existing = await User.findOne({ $or: [{ email: normEmail }, { username: normUsername }] });
    if (existing) {
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

/**
 * Login user (service-first; otherwise fallback).
 * Adds auto-unhide-on-login logic to maintain visibility state.
 */
export async function loginUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.loginUserService === 'function') {
    // Pass cookie options so service can set refresh cookie consistently
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

    // --- REPLACE START: auto-unhide-on-login (also sync visibility.*) ---
    try {
      const now = new Date();
      const hidden = Boolean(user.hidden);
      const until  = user.hiddenUntil ? new Date(user.hiddenUntil) : null;
      const resume = user.resumeOnLogin === true;

      if (hidden) {
        const shouldUnhideByTime = until && now >= until;
        // Use a labeled block to mirror the original structure without changing flow
        theShouldUnhideFlag: {
          const shouldUnhideByFlag = resume && (!until || now >= until);
          if (shouldUnhideByTime || shouldUnhideByFlag) {
            user.hidden = false;
            user.hiddenUntil = undefined;
            try {
              if (!user.visibility || typeof user.visibility !== 'object') user.visibility = {};
              user.visibility.isHidden = false;
              user.visibility.hiddenUntil = undefined;
            } catch { /* noop */ }
            await user.save().catch(() => {});
          }
        }
      }
    } catch {
      // keep login flow even if unhide logic fails silently
    }
    // --- REPLACE END ---

    const payload = buildJwtPayload(user);

    // Support both JWT_SECRET and ACCESS_TOKEN_SECRET (whichever is set)
    const accessSecret  = pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET) || 'dev_jwt_secret';
    const refreshSecret = pickFirstDefined(process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_SECRET) || 'dev_refresh_secret';

    const accessToken  = jwt.sign(payload, accessSecret,  { expiresIn: process.env.ACCESS_TOKEN_TTL  || '15m' });
    const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: process.env.REFRESH_TOKEN_TTL || '7d' });

    if (typeof res.cookie === 'function') res.cookie('refreshToken', refreshToken, refreshCookieOptions);
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

/**
 * Forgot Password
 * - Creates a one-time token (hashed at rest) with TTL
 * - Sends a reset link to user's email (generic success response to avoid enumeration)
 */
// --- REPLACE START: real forgot-password (creates token, emails link) ---
export async function forgotPassword(req, res) {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email });
    // Always respond with success to avoid account enumeration
    const genericResponse = { message: 'If an account exists for that email, a reset link has been sent.' };

    if (!user) return res.status(200).json(genericResponse);

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const ttlMinutes = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);
    user.passwordResetToken   = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await user.save();

    const appName = process.env.APP_NAME || 'Loventia';
    const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5174';
    const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

    const subject = `${appName} password reset`;
    const text = `You requested a password reset.\n\nClick the link to set a new password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;
    const html = `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a></p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    try { await sendMail({ to: email, subject, text, html }); } catch (mailErr) {
      console.error('[mail] Failed to send reset email:', mailErr?.message || mailErr);
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ error: 'Failed to process request.' });
  }
}
// --- REPLACE END ---

/**
 * Reset Password
 * - Verifies token + expiry
 * - Hashes new password and clears token fields
 * - Clears refresh cookie (optional but recommended)
 */
// --- REPLACE START: reset-password (verifies token, sets new password) ---
export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const now = new Date();

    const user = await User.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: now } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token.' });

    const saltRounds = parseInt(process.env.SALT_ROUNDS || '10', 10);
    user.password = await bcrypt.hash(password, saltRounds);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    try {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('refreshToken', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      }
    } catch {
      // ignore cookie clear failures
    }

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Profile
────────────────────────────────────────────────────────────────────────────── */

/**
 * Get my profile
 * Uses service if present; otherwise queries the model directly.
 */
export async function getMe(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMeService === 'function') return sv.getMeService(req, res);
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(String(id)).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    // --- REPLACE START: normalize outbound user (slashes + photos mirroring) ---
    return res.json(normalizeUserOut(user));
    // --- REPLACE END ---
  } catch (err) {
    console.error('getMe fallback error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

/**
 * Update my profile
 * The allowed fields list is intentionally explicit to avoid accidental overwrites.
 * We extend it to include visibility fields per requirement.
 */
export async function updateProfile(req, res) {
  const sv = await loadServices();
  if (typeof sv.updateProfileService === 'function') return sv.updateProfileService(req, res);
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [
      'username','email','summary','gender','orientation','goal','lookingFor','age','height','heightUnit',
      'weight','weightUnit','city','region','country','customCity','customRegion','customCountry',
      'profession','professionCategory','education','religion','religionImportance','children','pets',
      'nutritionPreferences','activityLevel','healthInfo','smoke','drink','drugs','latitude','longitude',
      'profilePhoto','extraImages','politicalIdeology','location','name','bodyType','preferredGender',
      'preferredMinAge','preferredMaxAge','preferredInterests','interests','status',
      // --- REPLACE START: allow hide/unhide fields through profile update when used internally ---
      'hidden','hiddenUntil','resumeOnLogin'
      // --- REPLACE END ---
    ];

    const patch = {};
    for (const k of allowed) {
      if (k in (req.body || {})) patch[k] = req.body[k];
    }

    // Backward compatible location field patching
    patch.location = patch.location || {};
    for (const key of ['country','region','city']) {
      if (req.body && key in req.body) patch.location[key] = req.body[key];
      if (req.body && (`location.${key}`) in req.body) patch.location[key] = req.body[`location.${key}`];
    }

    const user = await User.findById(String(id));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // --- REPLACE START: allow clearing fields with null (treat null as unset/empty) ---
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) {
        // Arrays → empty array, primitives → undefined, objects → undefined
        if (Array.isArray(user[k])) user[k] = [];
        else user[k] = undefined;
      } else if (typeof v === 'string' && v.trim() === '') {
        // Empty strings should clear optional text fields
        user[k] = undefined;
      } else {
        user[k] = v;
      }
    }
    // --- REPLACE END ---

    const saved = await user.save();
    // --- REPLACE START: normalize outbound user (slashes + photos mirroring) ---
    return res.json({ user: normalizeUserOut(saved) });
    // --- REPLACE END ---
  } catch (err) {
    console.error('updateProfile fallback error:', err);
    return res.status(500).json({ error: 'Profile update failed' });
  }
}

/**
 * Premium-related action placeholder (kept for parity with routes)
 */
export async function upgradeToPremium(req, res) {
  const sv = await loadServices();
  if (typeof sv.upgradeToPremiumService === 'function') return sv.upgradeToPremiumService(req, res);
  return res.status(501).json({ error: 'Not implemented (premium service missing)' });
}

/**
 * Matches-with-score placeholder (kept for parity)
 */
export async function getMatchesWithScore(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMatchesWithScoreService === 'function') return sv.getMatchesWithScoreService(req, res);
  return res.status(501).json({ error: 'Not implemented (matches service missing)' });
}

/**
 * Images
 */
// --- REPLACE START: images handlers with safe fallbacks (no more 501) ---
/**
 * Normalize Multer path → web path (/uploads/xxx.jpg)
 */
function toWebPathStrict(p) {
  if (!p) return '';
  const s = String(p).replace(/\\/g, '/').replace(/^\/?/, '');
  return `/${s}`;
}
/**
 * Resolve absolute FS path from a web path (/uploads/xxx.jpg)
 */
function absFromWebPath(webPath) {
  const clean = String(webPath || '').replace(/^\//, '');
  return path.resolve(process.cwd(), clean);
}
/**
 * Resolve the target user:
 * - Prefer req.params.id
 * - Fallback to req.user._id
 */
async function getTargetUser(req) {
  const id = req.params?.id || req.user?._id || req.user?.id || req.user?.userId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    const e = new Error('User id not provided or invalid');
    e.status = 400;
    throw e;
  }
  const user = await User.findById(String(id));
  if (!user) {
    const e = new Error('User not found');
    e.status = 404;
    throw e;
  }
  return user;
}
/**
 * Unified JSON response for FE compatibility.
 * Always include normalized user object to keep responses consistent.
 */
function sendImagesOk(res, user) {
  const list = Array.isArray(user.extraImages) ? user.extraImages : [];
  const normalized = normalizeUserOut(user);
  return res.status(200).json({
    extraImages: list,
    photos: list, // backward compatibility for older clients
    userId: user._id,
    user: normalized, // normalized user payload for all new clients
  });
}

export async function uploadExtraPhotos(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadExtraPhotosService === 'function') {
    return sv.uploadExtraPhotosService(req, res);
  }
  // Fallback: append uploaded files into user.extraImages
  try {
    const user = await getTargetUser(req);
    const files = Array.isArray(req.files) ? req.files : (req.files?.photos || []);
    const picked = (files || []).filter(Boolean);
    if (!picked.length) return res.status(400).json({ message: 'No files uploaded' });

    const newPaths = picked.map(f => toWebPathStrict(f.path || f.filename || ''));
    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];

    // Append + dedupe
    const merged = Array.from(new Set([...user.extraImages, ...newPaths].filter(Boolean)));
    user.extraImages = merged;

    await user.save();
    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || 'Upload failed' });
  }
}

export async function uploadPhotoStep(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadPhotoStepService === 'function') {
    return sv.uploadPhotoStepService(req, res);
  }
  // Fallback: replace at index if provided, else append single file
  try {
    const user = await getTargetUser(req);
    const files = Array.isArray(req.files) ? req.files : (req.files?.photos || []);
    const file = files?.[0];
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const idxRaw = req.query?.index ?? req.body?.index;
    const index = (idxRaw !== undefined && idxRaw !== null && idxRaw !== '') ? Number(idxRaw) : null;

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    const webPath = toWebPathStrict(file.path || file.filename || '');

    if (Number.isInteger(index) && index >= 0) {
      const prev = user.extraImages[index];
      user.extraImages[index] = webPath;
      // Try to remove replaced file from disk (best-effort)
      if (prev && prev !== webPath) {
        const absPrev = absFromWebPath(prev);
        fs.promises.unlink(absPrev).catch(() => {});
      }
    } else {
      if (!user.extraImages.includes(webPath)) user.extraImages.push(webPath);
    }

    await user.save();
    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || 'Upload step failed' });
  }
}

export async function deletePhotoSlot(req, res) {
  const sv = await loadServices();
  if (typeof sv.deletePhotoSlotService === 'function') {
    return sv.deletePhotoSlotService(req, res);
  }
  // Fallback: remove by index or exact path
  try {
    const user = await getTargetUser(req);
    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];

    const idxRaw = req.query?.index ?? req.body?.index;
    const pathRaw = req.query?.path ?? req.body?.path;

    let removed;
    if (idxRaw !== undefined && idxRaw !== null && idxRaw !== '') {
      const i = Number(idxRaw);
      if (!Number.isInteger(i) || i < 0 || i >= user.extraImages.length) {
        return res.status(400).json({ message: 'Invalid index' });
      }
      removed = user.extraImages.splice(i, 1)[0];
    } else if (pathRaw) {
      const web = toWebPathStrict(pathRaw);
      const before = user.extraImages.length;
      user.extraImages = user.extraImages.filter(p => toWebPathStrict(p) !== web);
      if (user.extraImages.length === before) {
        return res.status(404).json({ message: 'Image not found' });
      }
      removed = web;
    } else {
      return res.status(400).json({ message: 'Provide index or path to delete' });
    }

    await user.save();

    if (removed) {
      const abs = absFromWebPath(removed);
      fs.promises.unlink(abs).catch(() => {});
    }

    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || 'Delete failed' });
  }
}
// --- REPLACE END: images handlers with safe fallbacks (no more 501) ---

/* ──────────────────────────────────────────────────────────────────────────────
   Delete my account (cascade) – DELETE /api/users/me
────────────────────────────────────────────────────────────────────────────── */

/**
 * Delete the authenticated user, cascade-cleaning related resources.
 * We keep the logic explicit and similar to the original file for transparency.
 */
export async function deleteMeUser(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId || req.auth?.userId || req.auth?.id;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    let removedFiles = 0;
    try {
      if (user.profilePicture) { removeFileSafe(user.profilePicture); removedFiles += 1; }
      if (Array.isArray(user.extraImages)) {
        for (const p of user.extraImages) { removeFileSafe(p); removedFiles += 1; }
      }
    } catch (e) {
      console.warn('deleteMeUser file cleanup warning:', e?.message || e);
    }

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

    await User.findByIdAndDelete(String(uid));

    try {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('refreshToken', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      }
    } catch { /* noop */ }

    res.setHeader('X-Removed-Files', String(removedFiles));
    res.setHeader('X-Deleted-Messages', String(deletedMessages));
    return res.status(204).send();
  } catch (err) {
    console.error('deleteMeUser error:', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Hide / Unhide my account
   - PATCH /api/users/me/hide            (legacy/front compat)   -> hideMe
   - PATCH /api/users/me/visibility      (generic toggle)         -> setVisibilityMe
   - POST|PATCH /api/users/me/unhide     (force visible now)      -> unhideMe
   DiscoverController already hides hidden users by default.
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: hide/unhide endpoints (server-side) ---
/**
 * Generic visibility setter for the authenticated user.
 * Body: { hidden: boolean, minutes?: number, resumeOnLogin?: boolean }
 * - When hidden === true: sets hiddenUntil = now + minutes (if minutes > 0)
 * - When hidden === false: clears hiddenUntil
 * - Mirrors values into user.visibility.* for front-end backward-compat
 */
export async function setVisibilityMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { hidden, minutes, resumeOnLogin } = req.body || {};
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'Field "hidden" (boolean) is required.' });
    }

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.hidden = hidden;

    if (hidden) {
      const mins = Number.isFinite(+minutes) ? Math.max(0, Math.min(365 * 24 * 60, +minutes)) : 0;
      user.hiddenUntil = mins > 0 ? new Date(Date.now() + mins * 60 * 1000) : undefined;
    } else {
      user.hiddenUntil = undefined;
    }

    if (typeof resumeOnLogin === 'boolean') user.resumeOnLogin = resumeOnLogin;

    try {
      if (!user.visibility || typeof user.visibility !== 'object') user.visibility = {};
      user.visibility.isHidden    = !!user.hidden;
      user.visibility.hiddenUntil = user.hidden ? (user.hiddenUntil || undefined) : undefined;
      if (typeof resumeOnLogin === 'boolean') user.visibility.resumeOnLogin = resumeOnLogin;
    } catch { /* noop */ }

    await user.save();
    return res.status(200).json({
      ok: true,
      hidden: !!user.hidden,
      hiddenUntil: user.hiddenUntil || null,
      resumeOnLogin: user.resumeOnLogin === true,
      visibility: {
        isHidden: !!(user.visibility && user.visibility.isHidden),
        hiddenUntil: (user.visibility && user.visibility.hiddenUntil) || null,
        resumeOnLogin: !!(user.visibility && user.visibility.resumeOnLogin),
      },
    });
  } catch (err) {
    console.error('setVisibilityMe error:', err);
    return res.status(500).json({ error: 'Failed to update visibility' });
  }
}

/**
 * Legacy-compatible handler for PATCH /api/users/me/hide
 * Body (optional): { minutes?: number, resumeOnLogin?: boolean }
 * - Forces hidden = true
 * - Supports temporary hide for X minutes (capped)
 * - Mirrors values into user.visibility.*
 */
// --- REPLACE START: NEW legacy-compatible handler for PATCH /api/users/me/hide ---
export async function hideMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const minutes = Number.isFinite(+req.body?.minutes) ? +req.body.minutes : undefined;
    const resumeOnLogin = typeof req.body?.resumeOnLogin === 'boolean' ? req.body.resumeOnLogin : undefined;

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.hidden = true;
    user.hiddenUntil = Number.isFinite(minutes) && minutes > 0
      ? new Date(Date.now() + Math.min(minutes, 365 * 24 * 60) * 60 * 1000)
      : undefined;

    if (typeof resumeOnLogin === 'boolean') user.resumeOnLogin = resumeOnLogin;

    try {
      if (!user.visibility || typeof user.visibility !== 'object') user.visibility = {};
      user.visibility.isHidden = true;
      user.visibility.hiddenUntil = user.hiddenUntil || undefined;
      if (typeof resumeOnLogin === 'boolean') user.visibility.resumeOnLogin = resumeOnLogin;
    } catch { /* noop */ }

    await user.save();

    return res.status(200).json({
      ok: true,
      hidden: true,
      hiddenUntil: user.hiddenUntil || null,
      visibility: {
        isHidden: true,
        hiddenUntil: user.visibility?.hiddenUntil || null,
        resumeOnLogin: !!user.visibility?.resumeOnLogin,
      },
    });
  } catch (err) {
    console.error('hideMe error:', err);
    return res.status(500).json({ error: 'Failed to hide account' });
  }
}
// --- REPLACE END: NEW legacy-compatible handler ---

/**
 * Unhide handler (POST|PATCH /api/users/me/unhide)
 * - Clears hidden flags and hiddenUntil
 * - Mirrors into user.visibility.*
 */
export async function unhideMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.hidden = false;
    user.hiddenUntil = undefined;

    try {
      if (!user.visibility || typeof user.visibility !== 'object') user.visibility = {};
      user.visibility.isHidden = false;
      user.visibility.hiddenUntil = undefined;
    } catch { /* noop */ }

    await user.save();

    return res.status(200).json({
      ok: true,
      hidden: false,
      hiddenUntil: null,
      visibility: {
        isHidden: false,
        hiddenUntil: null,
        resumeOnLogin: !!(user.visibility && user.visibility.resumeOnLogin),
      },
    });
  } catch (err) {
    console.error('unhideMe error:', err);
    return res.status(500).json({ error: 'Failed to unhide account' });
  }
}
// --- REPLACE END ---

/* -----------------------------------------------------------------------------
 * Default export – preserved shape for route modules that import default
 * --------------------------------------------------------------------------- */
export default {
  // Account
  registerUser,
  loginUser,

  // Password reset
  forgotPassword,
  resetPassword,

  // Profile
  getMe,
  updateProfile,
  upgradeToPremium,
  getMatchesWithScore,

  // Images
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,

  // Account deletion
  deleteMeUser,

  // Visibility
  // --- REPLACE START: export hide/unhide ---
  setVisibilityMe,
  hideMe,      // <= NEW
  unhideMe,
  // --- REPLACE END ---
};
// --- REPLACE END ---
