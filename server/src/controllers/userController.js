// File: server/src/controllers/userController.js

// --- REPLACE START: /api/users/me returns normalized (with rewind) + backward-compatible shim ---
'use strict';

/**
 * Controller shim that keeps backward compatibility with legacy upstream while
 * allowing us to override specific handlers safely (e.g. getMe, forgotPassword).
 *
 * - We import the legacy/real controller (whatever the project uses).
 * - We optionally wrap some handlers (forgotPassword) to add logging and mail behavior.
 * - We OVERRIDE getMe so it always returns a normalized user and explicitly exposes `rewind`.
 *
 * All comments are in English; no unnecessary shortening; no destructive changes.
 */

import upstream from '../../controllers/userController.js'; // legacy/real controller path (CJS or ESM)
import { normalizeUserOut } from '../utils/normalizeUserOut.js';
import sendEmail from '../utils/sendEmail.js'; // used by forgotPassword wrapper
import { createRequire } from 'module';

const mod = (upstream && upstream.default) ? upstream.default : upstream;
const requireCJS = createRequire(import.meta.url);

/* ─────────────────────────────────────────────────────────────────────────────
 * Utilities
 * ────────────────────────────────────────────────────────────────────────────*/

function pickClientBaseUrl() {
  const url =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_CLIENT_BASE_URL ||
    process.env.WEB_APP_URL ||
    process.env.APP_URL ||
    '';
  return url || 'http://localhost:5174';
}

function pickResetTokenFromUpstream(req, res, maybeReturn) {
  if (maybeReturn && typeof maybeReturn === 'object') {
    const fromReturn =
      maybeReturn.resetToken ||
      maybeReturn.token ||
      maybeReturn.reset_password_token ||
      null;
    if (fromReturn) return fromReturn;
  }
  if (res && res.locals) {
    const fromLocals =
      res.locals.resetToken ||
      res.locals.token ||
      res.locals.reset_password_token ||
      null;
    if (fromLocals) return fromLocals;
  }
  if (req) {
    const fromReq =
      req.resetToken ||
      (req.body && (req.body.token || req.body.resetToken)) ||
      null;
    if (fromReq) return fromReq;
  }
  return null;
}

/**
 * Resolve the User model in a tolerant way:
 * - Prefer ESM model at ../models/User.js
 * - Fall back to CJS at ../../models/User.cjs
 */
async function resolveUserModel() {
  try {
    const esm = await import('../models/User.js');
    const User = esm.default || esm.User || esm;
    if (User && typeof User.findById === 'function') return User;
  } catch (_) {
    /* ignore */
  }
  try {
    const cjs = requireCJS('../../models/User.cjs');
    const User = cjs.default || cjs.User || cjs;
    if (User && typeof User.findById === 'function') return User;
  } catch (_) {
    /* ignore */
  }
  throw new Error('[userController] Unable to resolve User model (ESM or CJS).');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * forgotPassword wrapper (keeps existing behavior, adds logging+mail)
 * ────────────────────────────────────────────────────────────────────────────*/

const wrappedForgotPassword =
  (typeof mod?.forgotPassword === 'function')
    ? async function forgotPassword(req, res) {
        const rawEmail = (req?.body?.email || '').trim();
        const email = rawEmail.toLowerCase();

        console.log('[users] forgot-password called with:', email || '(empty email)');

        if (!email) {
          if (!res.headersSent) {
            return res.status(200).json({
              message: "If an account exists, we'll email a link shortly.",
            });
          }
          return;
        }

        let upstreamSent = false;
        let upstreamResult = null;
        try {
          const maybe = await mod.forgotPassword(req, res);
          upstreamResult = maybe;
          upstreamSent = !!res.headersSent;
        } catch (err) {
          console.warn(
            '[users] upstream forgotPassword threw, continuing with fallback mail:',
            err?.message || err
          );
        }

        const clientBase = pickClientBaseUrl();
        const upstreamToken = pickResetTokenFromUpstream(req, res, upstreamResult);
        const resetToken = upstreamToken || 'xxx-fallback-token';
        const resetUrl = `${clientBase}/reset-password?token=${resetToken}`;

        const appName = process.env.APP_NAME || 'Loventia';
        const subject = `${appName} password reset`;
        const text = [
          'Hello,',
          '',
          'We received a password reset request for this email address.',
          'To reset your password, open this link:',
          `${resetUrl}`,
          '',
          'If you did not request this, you can ignore this message.',
          '',
          `— ${appName}`,
        ].join('\n');

        const html = `
          <p>Hello,</p>
          <p>We received a password reset request for this email address.</p>
          <p><a href="${resetUrl}">Click here to reset your password</a></p>
          <p>If the button does not work, copy this link:</p>
          <p><code>${resetUrl}</code></p>
          <p>If you did not request this, you can ignore this message.</p>
          <p>— ${appName}</p>
        `.trim();

        const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || '';
        if (!smtpHost) {
          console.warn('[users] forgot-password: SMTP not configured. Email will be logged only.');
        }

        try {
          await sendEmail(email, subject, text, html);
          console.log(
            '[users] forgot-password: email dispatch attempted to:',
            email,
            'token:',
            resetToken !== 'xxx-fallback-token' ? '[real]' : '[fallback]'
          );
        } catch (mailErr) {
          console.error('[users] forgot-password: sendEmail failed:', mailErr?.message || mailErr);
        }

        if (!upstreamSent && !res.headersSent) {
          return res.status(200).json({
            message: "If an account exists, we'll email a link shortly.",
          });
        }
        return;
      }
    : mod?.forgotPassword;

/* ─────────────────────────────────────────────────────────────────────────────
 * getMe override — ALWAYS return normalized user with rewind visible
 * ────────────────────────────────────────────────────────────────────────────*/

/**
 * This override ensures:
 *  - We do NOT use .lean() (so we keep document transforms available if needed).
 *  - We explicitly select('+rewind') in case the schema has select:false.
 *  - We run normalizeUserOut(user) so FE always receives `rewind: { max, stackCount, stack: [...] }`
 *  - We keep responses/edge-cases clean (401/404/500).
 */
export async function getMe(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const User = await resolveUserModel();

    // If rewind had select:false in model, this makes it visible
    const user = await User.findById(userId).select('+rewind');
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(normalizeUserOut(user));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[users/me] error:', err);
    return res.status(500).json({ error: 'Server Error' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Default export & named re-exports — keep backward compatibility
 * ────────────────────────────────────────────────────────────────────────────*/

export default {
  ...(mod || {}),
  ...(wrappedForgotPassword ? { forgotPassword: wrappedForgotPassword } : {}),
  getMe, // our override takes precedence
};

// Named exports to preserve legacy imports
export const registerUser = mod?.registerUser;
export const loginUser = mod?.loginUser;
export const resetPassword = mod?.resetPassword;
export const getProfile = mod?.getProfile;
export const updateProfile = mod?.updateProfile;
export const upgradeToPremium = mod?.upgradeToPremium;
export const getMatchesWithScore = mod?.getMatchesWithScore;
export const uploadExtraPhotos = mod?.uploadExtraPhotos;
export const uploadPhotoStep = mod?.uploadPhotoStep;
export const deletePhotoSlot = mod?.deletePhotoSlot;
export const deleteMeUser = mod?.deleteMeUser;
export const setVisibilityMe = mod?.setVisibilityMe;
export const hideMe = mod?.hideMe;
export const unhideMe = mod?.unhideMe;

// Export the wrapper explicitly (if present)
export const forgotPassword = wrappedForgotPassword;
// --- REPLACE END ---

