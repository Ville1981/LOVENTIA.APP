// File: server/src/controllers/userController.js

// --- REPLACE START: ESM shim + forgot-password logging/wrapping ---
/**
 * ESM shim for user controller
 *
 * Purpose:
 * - Some parts of the app import from:  server/src/controllers/userController.js
 * - But the "real" controller may live in: server/controllers/userController.js  (one level up, often CJS)
 * - This shim normalizes both cases so we don't duplicate logic.
 *
 * Extra in this version:
 * - If the upstream controller ALSO exposes its own forgotPassword (i.e. /api/users/forgot-password),
 *   we wrap it and add the SAME logging / SMTP-warning behavior we just added to authController.
 *   That way BOTH endpoints:
 *      POST /api/auth/forgot-password
 *      POST /api/users/forgot-password
 *   behave the same, look the same in logs, and write to logs/mail-*.log via utils/sendEmail.js
 *
 * NOTE (2025-10-30):
 * - Earlier the wrapper called the upstream forgotPassword and returned immediately.
 *   That meant our own sendEmail(...) and "[users] forgot-password: ..." logs might never run
 *   if the upstream already returned 200.
 * - We now:
 *   1) call the upstream
 *   2) detect if the upstream already sent headers
 *   3) still attempt to send the email / write mail-log (so we get mail-*.log)
 *   4) and only send our JSON response if headers were NOT sent yet
 */

import upstream from "../../controllers/userController.js"; // upstream may be CJS or ESM
import sendEmail from "../utils/sendEmail.js"; // same helper we just updated

// Normalize to single object (works for `module.exports = {...}` and ESM default)
const mod = upstream && upstream.default ? upstream.default : upstream;

/**
 * Helper: best-effort client base URL, same as in authController
 */
function pickClientBaseUrl() {
  const url =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_CLIENT_BASE_URL ||
    process.env.WEB_APP_URL ||
    process.env.APP_URL ||
    "";
  return url || "http://localhost:5174";
}

/**
 * Try to extract a reset token from different places the upstream
 * controller might have placed it. This makes the wrapper tolerant
 * to several implementations.
 */
function pickResetTokenFromUpstream(req, res, maybeReturn) {
  // sometimes controller returns { resetToken: "..." }
  if (maybeReturn && typeof maybeReturn === "object") {
    const fromReturn =
      maybeReturn.resetToken ||
      maybeReturn.token ||
      maybeReturn.reset_password_token ||
      null;
    if (fromReturn) return fromReturn;
  }

  // sometimes controller stashes to res.locals
  if (res && res.locals) {
    const fromLocals =
      res.locals.resetToken ||
      res.locals.token ||
      res.locals.reset_password_token ||
      null;
    if (fromLocals) return fromLocals;
  }

  // sometimes middleware puts to req
  if (req) {
    const fromReq =
      req.resetToken ||
      (req.body && req.body.token) ||
      (req.body && req.body.resetToken) ||
      null;
    if (fromReq) return fromReq;
  }

  return null;
}

/**
 * Wrap ONLY if upstream actually has forgotPassword.
 * If not, we just export whatever is there (undefined).
 */
const wrappedForgotPassword =
  typeof mod?.forgotPassword === "function"
    ? async function forgotPassword(req, res) {
        // 1) read + normalize email
        const rawEmail = (req?.body?.email || "").trim();
        const email = rawEmail.toLowerCase();

        console.log(
          "[users] forgot-password called with:",
          email || "(empty email)"
        );

        // Always answer generic if email missing
        if (!email) {
          if (!res.headersSent) {
            return res.status(200).json({
              message: "If an account exists, we'll email a link shortly.",
            });
          }
          return;
        }

        // 2) call upstream FIRST but do NOT return immediately afterwards
        //    we want to run our mail + logging anyway
        let upstreamSent = false;
        let upstreamResult = null;
        try {
          const maybe = await mod.forgotPassword(req, res);
          upstreamResult = maybe;
          upstreamSent = !!res.headersSent;
        } catch (err) {
          console.warn(
            "[users] upstream forgotPassword threw, continuing with fallback mail:",
            err?.message || err
          );
        }

        // 3) build reset URL
        const clientBase = pickClientBaseUrl();

        // try to re-use token if upstream created one
        const upstreamToken = pickResetTokenFromUpstream(
          req,
          res,
          upstreamResult
        );
        const resetToken = upstreamToken || "xxx-fallback-token";
        const resetUrl = `${clientBase}/reset-password?token=${resetToken}`;

        const appName = process.env.APP_NAME || "Loventia";
        const subject = `${appName} password reset`;
        const text = [
          `Hello,`,
          ``,
          `We received a password reset request for this email address.`,
          `To reset your password, open this link:`,
          `${resetUrl}`,
          ``,
          `If you did not request this, you can ignore this message.`,
          ``,
          `— ${appName}`,
        ].join("\n");

        const html = `
          <p>Hello,</p>
          <p>We received a password reset request for this email address.</p>
          <p><a href="${resetUrl}">Click here to reset your password</a></p>
          <p>If the button does not work, copy this link:</p>
          <p><code>${resetUrl}</code></p>
          <p>If you did not request this, you can ignore this message.</p>
          <p>— ${appName}</p>
        `.trim();

        // 4) Check SMTP presence, but still attempt sendEmail so it can
        //    at least write logs/mail-*.log (our utils/sendEmail.js does that)
        const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
        if (!smtpHost) {
          console.warn(
            "[users] forgot-password: SMTP not configured (no SMTP_HOST/EMAIL_HOST). Email will be logged only."
          );
        }

        try {
          await sendEmail(email, subject, text, html);
          console.log(
            "[users] forgot-password: email dispatch attempted to:",
            email,
            "token:",
            resetToken !== "xxx-fallback-token" ? "[real]" : "[fallback]"
          );
        } catch (mailErr) {
          console.error(
            "[users] forgot-password: sendEmail failed:",
            mailErr?.message || mailErr
          );
        }

        // 5) Send generic response ONLY if upstream did NOT already send one
        if (!upstreamSent && !res.headersSent) {
          return res.status(200).json({
            message: "If an account exists, we'll email a link shortly.",
          });
        }

        // if upstream already sent (res.headersSent === true), we just stop
        return;
      }
    : mod?.forgotPassword; // upstream didn't have it, so keep as-is

// Default export: upstream object (controllers)
export default {
  ...mod,
  // override only forgotPassword if we wrapped
  ...(wrappedForgotPassword ? { forgotPassword: wrappedForgotPassword } : {}),
};

// Named exports to keep backward compatibility
export const registerUser = mod?.registerUser;
export const loginUser = mod?.loginUser;

// --- here is the one we actually care about ---
export const forgotPassword = wrappedForgotPassword;

// rest of your endpoints
export const resetPassword = mod?.resetPassword;
export const getMe = mod?.getMe;
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
// --- REPLACE END ---

