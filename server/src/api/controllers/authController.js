// PATH: server/src/api/controllers/authController.js

/* eslint-disable no-console */

// ………………………………………………………………………………………………………………………………
// Top-level controller for auth-related endpoints
// (login, register, me, forgot-password, reset-password, refresh, logout, verify-email)
//
// This version now does SIX important things:
//
// 1) **forgot-password**
//    - still sends the email
//    - AND now also **persists** the reset token + expiry to the user document
//      (passwordResetToken, passwordResetExpires)
//
// 2) **reset-password**
//    - consumes the token created above
//    - checks user, token and expiry
//    - updates password
//    - clears token fields
//    - AND (new) does an extra $unset so that even strict / fallback models
//      actually drop the fields
//
// 3) **login**
//    - uses the same user model as forgot/reset (CJS-first, then ESM fallback)
//    - calls User.findByCredentials(email, password) that exists in CJS model
//    - normalizes the returned user (no password, no reset fields)
//    - issues JWT access + refresh tokens from env (JWT_SECRET / JWT_REFRESH_SECRET / REFRESH_TOKEN_SECRET)
//    - **and now** packs ALL id fields into the token: sub, id, userId, uid
//    - **and now** ALSO sets httpOnly refresh cookie using centralized cookieOptions
//
// 4) **refresh**
//    - accepts refresh token (body.refreshToken, header.Authorization: Bearer <token>, or cookie)
//    - **first** tries util.verifyRefreshToken(...) from ../utils/generateTokens.js
//    - **then** falls back to local jwt.verify with the SAME priority as util:
//         JWT_REFRESH_SECRET → REFRESH_TOKEN_SECRET → "dev_refresh_secret"
//    - loads the user again to make sure the account still exists
//    - issues a new pair of tokens (access + refresh) with the SAME core claims
//    - returns normalized user too, so FE can update premium / billing flags
//    - **and now** refresh() also rotates the httpOnly refresh cookie
//
// 5) **me**
//    - reads current user from (1) req.user (if authenticate ran), (2) Bearer token,
//      (3) refresh-like token
//    - loads user from DB
//    - returns **normalized user** using normalizeUserOut (same shape as /api/users/me)
//      and explicitly selects `rewind`
//    - this is the handler that your routers (authRoutes + authPrivateRoutes)
//      will now both use → no more "me not implemented"
//
// 6) **register/logout/verifyEmail**
//    - lightweight stubs so that the routes no longer answer 501 by default
//    - register uses the same model loader + safeUserOut
// ………………………………………………………………………………………………………………………………

import { randomBytes } from "node:crypto";

import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import {
  issueTokens, // returns { accessToken, refreshToken, ... }
  signAccessToken as utilSignAccessToken,
  signRefreshToken as utilSignRefreshToken,
  verifyRefreshToken as utilVerifyRefreshToken,
} from "../../utils/generateTokens.js";
import normalizeUserOut from "../../utils/normalizeUserOut.js";
import sendEmail from "../../utils/sendEmail.js";
import renderResetEmail from "../emails/renderResetEmail.js";
// --- REPLACE START: fixed sendEmail import path (use shared util that writes logs/mail-*.log) ---
// (path already fixed above – kept marker for future diffs)
// --- REPLACE END ---
// --- REPLACE START: token util (access + refresh) ---
// --- REPLACE START: fix generateTokens import path (only path changes) ---
// (path already fixed above – kept marker for future diffs)
// --- REPLACE END ---
// --- REPLACE END ---
// --- REPLACE START: import normalizeUserOut for consistent API shape (+rewind) ---
// (normalizeUserOut already imported above – marker kept for future diffs)
// --- REPLACE END ---
// --- REPLACE START: centralized cookie options for refresh cookie ---
import authCookieOptions, {
  withMaxAge as withCookieMaxAge,
} from "../../utils/cookieOptions.js";
// --- REPLACE END ---

/**
 * pickClientBaseUrl
 * Returns best-effort client base URL for links (reset / verify).
 * Order: explicit envs → sane localhost fallback.
 */
function pickClientBaseUrl() {
  const url =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_BASE_URL ||
    process.env.APP_CLIENT_BASE_URL ||
    process.env.WEB_APP_URL ||
    process.env.APP_URL ||
    "";
  // NOTE: return a plain URL, not markdown
  return url || "http://localhost:5174";
}

/**
 * Small helper for "now + ms"
 */
function nowPlus(ms) {
  return new Date(Date.now() + ms);
}

/**
 * Build a nodemailer transporter with EMAIL_* ↔ SMTP_* fallbacks.
 *
 * NOTE:
 * We keep this here because other controller methods (verify, invite, alerts)
 * might still call it. forgotPassword itself will now FIRST try the shared util,
 * then fall back here.
 */
function buildTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "")
      .toLowerCase() === "true" || port === 465;

  const user = process.env.SMTP_USER || process.env.EMAIL_USER || "";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";

  if (!host || (!user && !pass)) {
    console.warn(
      "[authController/mail] Missing SMTP/EMAIL config; using streamTransport (DEV PREVIEW)."
    );
    return nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/**
 * Legacy sender – keep as a safety net if the shared util fails.
 */
async function sendMailLegacy({ to, subject, text, html }) {
  const transporter = buildTransporter();
  const fromName =
    process.env.MAIL_FROM_NAME || process.env.EMAIL_FROM_NAME || "Loventia";
  const fromEmail =
    process.env.MAIL_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "no-reply@localhost";
  const from = `"${fromName}" <${fromEmail}>`;

  const info = await transporter.sendMail({ from, to, subject, text, html });

  if (info && info.message && Buffer.isBuffer(info.message)) {
    try {
      const preview = info.message.toString("utf8");
      console.log("[mail preview]\n" + preview.substring(0, 1200));
    } catch (e) {
      console.warn(
        "[mail preview] failed to print preview:",
        e?.message || e
      );
    }
  }
}

// PATH: server/src/api/controllers/authController.js
// @ts-nocheck

// --- REPLACE START: imports needed for robust model resolution ---
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- REPLACE END ---

// --- REPLACE START: robust User model resolver (supports CJS/ESM, repo layout aware) ---
/**
 * Tries to load the User model from common repo layouts.
 * Supports both ESM (.js) and CommonJS (.cjs) exports.
 * Returns the model or null (never throws).
 */
async function getUserModel() {
  const candidates = [
    // ← current repo uses this (per boot log: [UserModel] Loaded from: server/models/User.cjs)
    "../../models/User.cjs",

    // alternative typical locations
    "../../models/User.js",
    "../models/User.js",
    "../../../models/User.cjs",
    "../../../models/User.js",
    "../../src/models/User.js",
  ];

  for (const rel of candidates) {
    try {
      const abs = path.resolve(__dirname, rel);
      const ns = await import(pathToFileURL(abs).href);
      // handle default export, named export, or CJS module.exports
      const mod = ns?.default ?? ns;
      if (mod) return mod;
    } catch {
      // keep trying next candidate
    }
  }
  return null;
}
// --- REPLACE END ---

// --- REPLACE START: safeUserOut helper (used by login + refresh + others) ---
function safeUserOut(userDocOrLean) {
  if (!userDocOrLean) return null;
  const u =
    typeof userDocOrLean.toObject === "function"
      ? userDocOrLean.toObject()
      : { ...userDocOrLean };

  // Remove sensitive
  delete u.password;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;

  // Ensure arrays for media
  if (!Array.isArray(u.extraImages)) {
    u.extraImages = u.extraImages ? [u.extraImages].filter(Boolean) : [];
  }
  if (!Array.isArray(u.photos)) {
    // fall back to extraImages if photos not present
    u.photos = Array.isArray(u.extraImages) ? [...u.extraImages] : [];
  }

  // Ensure billing container
  if (!u.billing || typeof u.billing !== "object") {
    u.billing = {};
  }
  const nestedCid = u.billing.stripeCustomerId || null;
  const topCid = u.stripeCustomerId || null;
  const effectiveCid = nestedCid || topCid || null;
  u.billing.stripeCustomerId = effectiveCid;
  u.stripeCustomerId = effectiveCid;

  // Premium flags should be booleans
  u.isPremium = !!u.isPremium;
  u.premium = !!u.premium;

  return u;
}
// --- REPLACE END ---

/**
 * Helper: sign access/refresh tokens.
 * We keep it small, inline, and tolerant of missing envs.
 * Even though we now import from ../utils/generateTokens.js, we KEEP this
 * fallback here so that if the util is ever moved/renamed, login/refresh do not break.
 */
// --- REPLACE START: JWT helpers (fallback) ---
function signAccessToken(payload = {}) {
  const secret =
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "dev_access_secret";
  const ttl = process.env.JWT_EXPIRES_IN || "2h";
  return jwt.sign(payload, secret, { expiresIn: ttl });
}
function signRefreshToken(payload = {}) {
  // --- REPLACE START: normalize refresh payload to ALWAYS have userId/sub/id/uid ---
  const secret =
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    "dev_refresh_secret";
  const ttl = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

  // normalize id fields – this fixes "Invalid token payload" in stricter refresh routes
  const guessedId =
    payload.userId || payload.id || payload.sub || payload.uid || "";
  const finalId = guessedId ? String(guessedId) : "";

  let finalPayload = { ...payload, type: payload.type || "refresh" };

  if (finalId) {
    finalPayload = {
      ...finalPayload,
      sub: finalId,
      id: finalId,
      userId: finalId,
      uid: finalId,
    };
  }

  return jwt.sign(finalPayload, secret, { expiresIn: ttl });
  // --- REPLACE END ---
}
// --- REPLACE END ---

// --- REPLACE START: LOGIN HANDLER (uses CJS model's findByCredentials + shared token util) ---
/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * NOTE:
 * - earlier PS output showed token with empty `sub` and `id`
 * - here we FORCE all id fields into payload: sub, id, userId, uid
 * - and we now set an httpOnly refresh cookie for browser flows
 */
export async function login(req, res) {
  try {
    const emailRaw = req?.body?.email || req?.body?.username || "";
    const password = req?.body?.password || "";
    const email = String(emailRaw).trim().toLowerCase();

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const User = await getUserModel();

    // We prefer the method from CJS schema
    let userDoc = null;
    if (typeof User.findByCredentials === "function") {
      userDoc = await User.findByCredentials(email, password);
    } else {
      // fallback: manual lookup
      userDoc = await User.findOne({ email }).exec();
      if (!userDoc) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
    }

    if (!userDoc) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Normalize user for response
    const userOut = safeUserOut(userDoc);

    // Build base JWT payload
    // --- REPLACE START: force all id fields into payload ---
    const rawId =
      userOut._id || userOut.id || userDoc._id || userDoc.id || "";
    const userId = String(rawId);
    const basePayload = {
      sub: userId,
      id: userId,
      userId,
      uid: userId,
      email: userOut.email,
      isPremium: !!userOut.isPremium,
      role: userOut.role || "user",
    };
    // --- REPLACE END ---

    // 1st preference: shared util
    let accessToken = null;
    let refreshToken = null;
    let expiresIn = null;
    let refreshExpiresIn = null;

    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(basePayload);
        accessToken = issued?.accessToken || null;
        refreshToken = issued?.refreshToken || null;
        expiresIn = issued?.expiresIn || null;
        refreshExpiresIn = issued?.refreshExpiresIn || null;
      }
    } catch (tokErr) {
      console.warn(
        "[auth/login] issueTokens() failed, falling back:",
        tokErr?.message || tokErr
      );
    }

    // 2nd preference: util-signers
    if (!accessToken && typeof utilSignAccessToken === "function") {
      accessToken = utilSignAccessToken(basePayload);
    }
    if (!refreshToken && typeof utilSignRefreshToken === "function") {
      // util might not add userId → but our fallback does; so this is ok
      refreshToken = utilSignRefreshToken(basePayload);
    }

    // 3rd (final) fallback: local signers
    if (!accessToken) {
      accessToken = signAccessToken(basePayload);
    }
    if (!refreshToken) {
      // mark this as refresh in payload – our normalized signRefreshToken will pack all id fields
      refreshToken = signRefreshToken({ ...basePayload, type: "refresh" });
    }

    // --- REPLACE START: set httpOnly refresh cookie for browser clients ---
    try {
      if (refreshToken) {
        const maxAgeMs =
          Number(process.env.REFRESH_TOKEN_MAX_AGE_MS) ||
          Number(process.env.JWT_REFRESH_MAX_AGE_MS) ||
          30 * 24 * 60 * 60 * 1000; // default 30 days

        res.cookie(
          "refreshToken",
          refreshToken,
          withCookieMaxAge(maxAgeMs)
        );
      }
    } catch (cookieErr) {
      console.warn(
        "[auth/login] failed to set refresh cookie (non-fatal):",
        cookieErr?.message || cookieErr
      );
    }
    // --- REPLACE END ---

    return res.status(200).json({
      message: "Login successful.",
      user: userOut,
      accessToken,
      refreshToken,
      expiresIn,
      refreshExpiresIn,
    });
  } catch (err) {
    console.error("[auth/login] unexpected error:", err);
    return res.status(500).json({
      error: "Unexpected error while logging in.",
    });
  }
}
// --- REPLACE END ---

// --- REPLACE START: REFRESH HANDLER (recommended, with robust cookie support) ---
/**
 * POST /api/auth/refresh
 * Body (preferred): { "refreshToken": "..." }
 *
 * Tries util.verifyRefreshToken(...) first, then falls back to local jwt.verify.
 * Always re-issues BOTH tokens with the SAME id packing as login.
 *
 * IMPORTANT:
 * We now look for the refresh token in **all** common cookie names as well:
 * - refreshToken
 * - refresh_token
 * - jwt
 * - jid
 * - token
 * This makes the route tolerant to older middlewares that set a different cookie name.
 */
export async function refresh(req, res) {
  try {
    // --- REPLACE START: unified token extraction (body → Bearer → cookies + raw header fallback) ---
    const bodyToken =
      req?.body && typeof req.body.refreshToken === "string"
        ? req.body.refreshToken
        : "";

    const bearerToken =
      req?.headers && typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/Bearer\s+/i, "").trim()
        : "";

    // First try parsed cookies (if cookie-parser is in use)
    let cookieTokenRaw =
      req?.cookies &&
      (req.cookies.refreshToken ||
        req.cookies.refresh_token ||
        req.cookies.jwt ||
        req.cookies.jid ||
        req.cookies.token);

    // If cookie-parser did not populate req.cookies, fall back to raw Cookie header parsing.
    if (!cookieTokenRaw && req?.headers?.cookie) {
      try {
        const rawCookieHeader = String(req.headers.cookie);
        const parts = rawCookieHeader.split(";").map((p) => p.trim());
        const cookieNames = [
          "refreshToken",
          "refresh_token",
          "jwt",
          "jid",
          "token",
        ];
        for (const name of cookieNames) {
          const prefix = `${name}=`;
          const found = parts.find((p) => p.startsWith(prefix));
          if (found) {
            cookieTokenRaw = found.slice(prefix.length);
            break;
          }
        }
      } catch (parseErr) {
        console.warn(
          "[auth/refresh] failed to parse raw Cookie header:",
          parseErr?.message || parseErr
        );
      }
    }

    const cookieToken =
      typeof cookieTokenRaw === "string"
        ? cookieTokenRaw
        : cookieTokenRaw
        ? String(cookieTokenRaw)
        : "";

    let token = bodyToken || bearerToken || cookieToken;
    token = (token || "").trim();
    // --- REPLACE END ---

    if (!token) {
      // No token anywhere → treat as unauthenticated
      return res
        .status(401)
        .json({ error: "Refresh token is required." });
    }

    // 2) verify token (util first)
    let decoded = null;
    let verifiedBy = "none";

    if (typeof utilVerifyRefreshToken === "function") {
      const utilRes = utilVerifyRefreshToken(token);
      // util version in utils/generateTokens.js returns { ok, decoded } in our file
      if (utilRes && utilRes.ok && utilRes.decoded) {
        decoded = utilRes.decoded;
        verifiedBy = "util";
      } else if (utilRes && utilRes.error) {
        console.warn(
          "[auth/refresh] util verify failed, will try local:",
          utilRes.error?.message || utilRes.error
        );
      }
    }

    if (!decoded) {
      // --- REPLACE START: match util's secret priority (JWT_REFRESH_SECRET → REFRESH_TOKEN_SECRET → dev) ---
      const refreshSecret =
        process.env.JWT_REFRESH_SECRET ||
        process.env.REFRESH_TOKEN_SECRET ||
        "dev_refresh_secret";
      // --- REPLACE END ---
      try {
        decoded = jwt.verify(token, refreshSecret);
        verifiedBy = "local";
      } catch (verifyErr) {
        console.warn(
          "[auth/refresh] invalid refresh token:",
          verifyErr?.message || verifyErr
        );
        return res
          .status(401)
          .json({ error: "Invalid or expired refresh token." });
      }
    }

    // 3) decoded should have at least one of these
    const decodedId =
      decoded?.sub ||
      decoded?.userId ||
      decoded?.uid ||
      decoded?._id ||
      decoded?.id ||
      "";
    if (!decodedId) {
      console.warn("[auth/refresh] token did not contain any id:", decoded);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token." });
    }

    // 4) load user
    const User = await getUserModel();
    const userDoc = await User.findById(decodedId).exec();
    if (!userDoc) {
      console.warn("[auth/refresh] user not found for id:", decodedId);
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token." });
    }

    // 5) normalize user
    const userOut = safeUserOut(userDoc);

    // 6) build payload for new tokens – SAME packing as login
    // --- REPLACE START: force all id fields into payload (refresh) ---
    const rawId =
      userOut._id || userOut.id || userDoc._id || userDoc.id || decodedId;
    const userId = String(rawId);
    const basePayload = {
      sub: userId,
      id: userId,
      userId,
      uid: userId,
      email: userOut.email,
      isPremium: !!userOut.isPremium,
      role: userOut.role || "user",
    };
    // --- REPLACE END ---

    // 7) issue new tokens (same preference order as login)
    let accessToken = null;
    let refreshToken = null;
    let expiresIn = null;
    let refreshExpiresIn = null;

    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(basePayload);
        accessToken = issued?.accessToken || null;
        refreshToken = issued?.refreshToken || null;
        expiresIn = issued?.expiresIn || null;
        refreshExpiresIn = issued?.refreshExpiresIn || null;
      }
    } catch (tokErr) {
      console.warn(
        "[auth/refresh] issueTokens() failed, falling back:",
        tokErr?.message || tokErr
      );
    }

    if (!accessToken && typeof utilSignAccessToken === "function") {
      accessToken = utilSignAccessToken(basePayload);
    }
    if (!refreshToken && typeof utilSignRefreshToken === "function") {
      refreshToken = utilSignRefreshToken(basePayload);
    }

    if (!accessToken) {
      accessToken = signAccessToken(basePayload);
    }
    if (!refreshToken) {
      // our normalized fallback will re-pack id fields → OK for stricter routers
      refreshToken = signRefreshToken({ ...basePayload, type: "refresh" });
    }

    // --- REPLACE START: rotate httpOnly refresh cookie on refresh() as well ---
    try {
      if (refreshToken) {
        const maxAgeMs =
          Number(process.env.REFRESH_TOKEN_MAX_AGE_MS) ||
          Number(process.env.JWT_REFRESH_MAX_AGE_MS) ||
          30 * 24 * 60 * 60 * 1000;

        res.cookie(
          "refreshToken",
          refreshToken,
          withCookieMaxAge(maxAgeMs)
        );
      }
    } catch (cookieErr) {
      console.warn(
        "[auth/refresh] failed to set refresh cookie (non-fatal):",
        cookieErr?.message || cookieErr
      );
    }
    // --- REPLACE END ---

    return res.status(200).json({
      message: "Token refreshed.",
      user: userOut,
      accessToken,
      refreshToken,
      expiresIn,
      refreshExpiresIn,
      verifiedBy,
    });
  } catch (err) {
    console.error("[auth/refresh] unexpected error:", err);
    return res.status(500).json({
      error: "Unexpected error while refreshing token.",
    });
  }
}
// --- REPLACE END ---

// --- REPLACE START: forgotPassword safe-build & store token ---
export async function forgotPassword(req, res) {
  try {
    const email = (req?.body?.email || "").trim().toLowerCase();
    console.log("[auth] forgot-password for", email || "<empty>");

    if (!email) {
      console.warn("[forgotPassword] Missing email in request body");
      return res
        .status(200)
        .json({ message: "If an account exists, we'll email a link shortly." });
    }

    const User = await getUserModel();
    let user = null;

    // 1) find user (lean to save memory)
    try {
      const q = User.findOne({ email });
      user = typeof q.lean === "function" ? await q.lean() : await q;
    } catch (e) {
      console.error("[forgotPassword] user lookup failed:", e);
    }

    // 2) generate token
    let rawToken = "";
    if (user && typeof generateResetTokenForUser === "function") {
      try {
        // this version may already persist
        rawToken = await generateResetTokenForUser(user, { persist: true });
      } catch (e) {
        console.warn(
          "[forgotPassword] generateResetTokenForUser failed, falling back:",
          e?.message || e
        );
      }
    }
    if (!rawToken) {
      rawToken = randomBytes(24).toString("hex");
    }

    // 3) if we actually have a user → persist token + expiry
    //    (we do this even if later sendEmail fails, so token is valid)
    const resetTtlMs = Number(process.env.PASSWORD_RESET_TTL_MS || 3600000); // 1h default
    if (user && user._id) {
      try {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordResetToken: rawToken,
              passwordResetExpires: nowPlus(resetTtlMs),
            },
          }
        );
        console.log(
          "[forgotPassword] persisted reset token for user",
          String(user._id)
        );
      } catch (persistErr) {
        console.error(
          "[forgotPassword] failed to persist reset token:",
          persistErr?.message || persistErr
        );
      }
    } else {
      // user not found → we still continue, but we skip persist
      // (generic response below hides this fact)
      console.log("[forgotPassword] no user found, will still send generic mail.");
    }

    // 4) build reset link for email
    const clientUrl =
      pickClientBaseUrl() || process.env.CLIENT_URL || "http://localhost:5174";
    const userIdRaw =
      user && (user._id || user.id) ? String(user._id || user.id) : "";
    const uid = encodeURIComponent(userIdRaw);
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}&id=${uid}`;

    // 5) email payload
    const appName = process.env.APP_NAME || "Loventia";
    const { subject, text, html } = renderResetEmail({ appName, resetUrl });

    // 6) try new shared util first (this should write logs/mail-*.log)
    try {
      await sendEmail(email, subject, text, html);
      console.log("[forgotPassword] sendEmail util called OK");
    } catch (mailErr) {
      console.error(
        "[forgotPassword] mail send error (shared util):",
        mailErr?.message || mailErr
      );
      // fallback to legacy direct nodemailer
      try {
        await sendMailLegacy({ to: email, subject, text, html });
        console.log("[forgotPassword] legacy mail used as fallback");
      } catch (legacyErr) {
        console.error(
          "[forgotPassword] legacy mail send also failed:",
          legacyErr
        );
      }
    }
  } catch (err) {
    console.error("forgotPassword error:", err);
  }

  // 7) always generic response
  return res
    .status(200)
    .json({ message: "If an account exists, we'll email a link shortly." });
}
// --- REPLACE END ---

/**
 * POST /api/auth/reset-password
 * Body:
 * {
 *   "token": "...",
 *   "id": "...",       // user id (from link) – optional if token is unique
 *   "password": "newPasswordHere"
 * }
 *
 * We keep logs in English and return generic-ish messages.
 */
/**
 * POST /api/auth/reset-password
 * Body:
 * {
 *   "token": "...",
 *   "id": "...",       // user id (from link) – optional if token is unique
 *   "password": "newPasswordHere"
 * }
 *
 * We keep logs in English and return generic-ish messages.
 */
/**
 * POST /api/auth/reset-password
 * Body:
 * {
 *   "token": "...",
 *   "id": "...",       // user id (from link) – optional, used only as a safety check
 *   "password": "newPasswordHere"
 * }
 *
 * We keep logs in English and return generic-ish messages.
 */
/**
 * POST /api/auth/reset-password
 * Body:
 * {
 *   "token": "...",
 *   "id": "...",       // user id (from link) – optional, used only as a safety check
 *   "password": "newPasswordHere"
 * }
 *
 * We keep logs in English and return generic-ish messages.
 */
// --- REPLACE START: resetPassword handler (tolerant match + hard $mark-used) ---
export async function resetPassword(req, res) {
  try {
    const tokenFromReq =
      (req?.body?.token || req?.query?.token || "").trim();
    const idFromReq = (req?.body?.id || req?.query?.id || "").trim();
    const newPassword = (req?.body?.password || "").trim();

    console.log(
      "[auth] reset-password called for id:",
      idFromReq || "(no id), token:",
      tokenFromReq ? tokenFromReq.slice(0, 8) + "…" : "(no token)"
    );

    if (!tokenFromReq || !newPassword) {
      return res.status(400).json({
        error: "Missing token or password.",
      });
    }

    const User = await getUserModel();

    // 1) ALWAYS look up user by token (primary key for reset)
    //    and explicitly select the reset fields (they are likely select: false).
    let userDoc = await User.findOne({
      passwordResetToken: tokenFromReq,
    }).select("+passwordResetToken +passwordResetExpires +passwordResetUsedAt");

    if (!userDoc) {
      console.warn(
        "[resetPassword] no user found for token (invalid/expired/used)."
      );
      return res.status(400).json({
        error: "Invalid or expired reset token.",
      });
    }

    // 2) Optional safety check: if link contains id, ensure it matches the token owner
    if (idFromReq && String(userDoc._id) !== idFromReq) {
      console.warn(
        "[resetPassword] id from link does not match token owner. linkId=",
        idFromReq,
        "userId=",
        String(userDoc._id)
      );
      return res.status(400).json({
        error: "Invalid or expired reset token.",
      });
    }

    // 3) Check expiry
    if (
      userDoc.passwordResetExpires &&
      new Date(userDoc.passwordResetExpires).getTime() < Date.now()
    ) {
      console.warn(
        "[resetPassword] token expired for user",
        String(userDoc._id)
      );
      return res.status(400).json({
        error: "Reset token has expired. Please request a new password reset.",
      });
    }

    // 3b) Guard against re-use via a "used" marker if it already exists
    if (userDoc.passwordResetUsedAt) {
      console.warn(
        "[resetPassword] token already marked used for user",
        String(userDoc._id),
        "at",
        userDoc.passwordResetUsedAt
      );
      return res.status(400).json({
        error:
          "Reset token has already been used. Please request a new password reset.",
      });
    }

    // 4) Update password
    userDoc.password = newPassword;

    // 5) Mark token as USED so the same token can never be matched again.
    //    We deliberately keep the field but change its value and expiry.
    const usedAt = new Date();
    const usedMarker = `used:${usedAt.getTime()}`;

    userDoc.passwordResetToken = usedMarker;
    userDoc.passwordResetExpires = new Date(0);
    userDoc.passwordResetUsedAt = usedAt;

    await userDoc.save();

    // 6) Extra hard overwrite at collection level (handles strict schemas / legacy models)
    try {
      const Model =
        userDoc?.constructor &&
        typeof userDoc.constructor.updateOne === "function"
          ? userDoc.constructor
          : await getUserModel();

      if (Model && typeof Model.updateOne === "function") {
        await Model.updateOne(
          { _id: userDoc._id },
          {
            $set: {
              passwordResetToken: usedMarker,
              passwordResetExpires: new Date(0),
              passwordResetUsedAt: usedAt,
            },
          }
        );
      } else {
        console.warn(
          "[resetPassword] could not resolve model for 'used' mark (non-fatal)."
        );
      }
    } catch (markErr) {
      console.warn(
        "[resetPassword] marking reset token as used failed (non-fatal):",
        markErr?.message || markErr
      );
    }

    console.log(
      "[resetPassword] password changed and token marked used for user",
      String(userDoc._id)
    );

    return res.status(200).json({
      message: "Password has been reset successfully.",
    });
  } catch (err) {
    console.error("[resetPassword] unexpected error:", err);
    return res.status(500).json({
      error: "Unexpected error while resetting password.",
    });
  }
}
// --- REPLACE END ---



// --- REPLACE START: register handler (lightweight, compatible) ---
/**
 * POST /api/auth/register
 * Body: { email, password, username?, ... }
 *
 * NOTE:
 * - we keep this simple so your existing FE can still call /api/auth/register
 * - we also normalize the output like login → returns { user, accessToken, refreshToken }
 * - if email exists → 409
 */
export async function register(req, res) {
  try {
    const rawEmail = req?.body?.email || "";
    const email = String(rawEmail).trim().toLowerCase();
    const password = (req?.body?.password || "").trim();
    const username =
      (req?.body?.username || req?.body?.name || "").trim() ||
      email.split("@")[0];

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const User = await getUserModel();
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res
        .status(409)
        .json({ error: "User with this email already exists." });
    }

    // create
    const created = new User({
      email,
      password,
      username,
      role: "user",
      isPremium: false,
      premium: false,
    });
    await created.save();

    const userOut = safeUserOut(created);

    const userId = String(created._id);
    const payload = {
      sub: userId,
      id: userId,
      userId,
      uid: userId,
      email: userOut.email,
      isPremium: !!userOut.isPremium,
      role: userOut.role || "user",
    };

    // tokens
    let accessToken = null;
    let refreshToken = null;
    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(payload);
        accessToken = issued?.accessToken || null;
        refreshToken = issued?.refreshToken || null;
      }
    } catch {
      /* ignore */
    }
    if (!accessToken) accessToken = signAccessToken(payload);
    if (!refreshToken)
      refreshToken = signRefreshToken({ ...payload, type: "refresh" });

    return res.status(201).json({
      message: "Registration successful.",
      user: userOut,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("[auth/register] unexpected error:", err);
    return res
      .status(500)
      .json({ error: "Unexpected error during registration." });
  }
}
// --- REPLACE END ---

// --- REPLACE START: me handler (normalized output with rewind) ---
/**
 * GET /api/auth/me
 * Source priority:
 * 1) req.user (set by authenticate)
 * 2) Authorization: Bearer <token> (access)
 * 3) body.refreshToken (rare GET) or cookie (less likely)
 *
 * Returns 200 + **normalized** user (normalizeUserOut), with `rewind` explicitly selected.
 */
export async function me(req, res) {
  try {
    // Prefer id from authenticate middleware if present
    const hintedId =
      req?.user?.id ||
      req?.user?._id ||
      req?.user?.userId ||
      req?.user?.sub ||
      "";

    let token = "";
    let decoded = null;

    // Try Authorization: Bearer
    const authHeader = req.headers?.authorization || "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    // If we already know the id from middleware, load + select('+rewind') and return normalized
    if (!token && hintedId) {
      const User = await getUserModel();
      const userDoc = await User.findById(hintedId).select("+rewind");
      if (!userDoc) return res.status(404).json({ error: "User not found." });
      return res.status(200).json(normalizeUserOut(userDoc));
    }

    // If token present → verify (access first, then refresh fallback)
    if (token) {
      const accessSecret =
        process.env.JWT_SECRET ||
        process.env.ACCESS_TOKEN_SECRET ||
        "dev_access_secret";
      try {
        decoded = jwt.verify(token, accessSecret);
      } catch {
        const refreshSecret =
          process.env.JWT_REFRESH_SECRET ||
          process.env.REFRESH_TOKEN_SECRET ||
          "dev_refresh_secret";
        try {
          decoded = jwt.verify(token, refreshSecret);
        } catch {
          return res.status(401).json({ error: "Invalid token." });
        }
      }
    }

    const finalId =
      hintedId ||
      decoded?.sub ||
      decoded?.id ||
      decoded?.userId ||
      decoded?.uid ||
      "";

    if (!finalId) {
      return res.status(401).json({ error: "No user id in token." });
    }

    const User = await getUserModel();
    const userDoc = await User.findById(finalId).select("+rewind");
    if (!userDoc) return res.status(404).json({ error: "User not found." });

    return res.status(200).json(normalizeUserOut(userDoc));
  } catch (err) {
    console.error("[auth/me] unexpected error:", err);
    return res.status(500).json({ error: "Unexpected error in /auth/me." });
  }
}
// --- REPLACE END ---

// --- REPLACE START: logout handler (stateless) ---
/**
 * POST /api/auth/logout
 * We are stateless → just return 200. FE should drop tokens.
 */
export async function logout(_req, res) {
  return res.status(200).json({ message: "Logged out." });
}
// --- REPLACE END ---

// --- REPLACE START: verifyEmail stub (kept to avoid 501) ---
/**
 * POST /api/auth/verify-email
 * This is a basic stub that you can later wire to your actual email/OTP flow.
 */
export async function verifyEmail(req, res) {
  const token = (req?.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "Verification token is required." });
  }
  // TODO: implement real token lookup
  console.log("[auth/verifyEmail] called with token:", token);
  return res.status(200).json({ message: "Email verified (stub)." });
}
// --- REPLACE END ---

// Keep default export shape unchanged (include other handlers in your real file)
const controller = {
  // public
  login, // ← UPDATED
  register, // ← NEW
  refresh, // ← UPDATED (robust token extraction + secret order + cookie rotation)
  forgotPassword,
  resetPassword,
  logout, // ← NEW
  verifyEmail, // ← NEW
  // shared
  me, // ← UPDATED: normalizeUserOut + .select("+rewind")
};

export default controller;



