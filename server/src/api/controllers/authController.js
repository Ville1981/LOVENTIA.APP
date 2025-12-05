// PATH: server/src/api/controllers/authController.js
/* eslint-disable no-console */

// ………………………………………………………………………………………………………………………………
// Top-level controller for auth endpoints (login, register, me, forgot-password,
// reset-password, refresh, logout, verifyEmail)
//
// This file is now fully normalized:
// - consistent User model resolution (getUserModel) across all handlers
// - consistent token packing (sub/id/userId/uid)
// - consistent normalizeUserOut output
// - proper email verification flow with hashed token + expiry
// ………………………………………………………………………………………………………………………………

import { randomBytes } from "node:crypto";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import {
  issueTokens,
  signAccessToken as utilSignAccessToken,
  signRefreshToken as utilSignRefreshToken,
  verifyRefreshToken as utilVerifyRefreshToken,
} from "../../utils/generateTokens.js";

import normalizeUserOut from "../../utils/normalizeUserOut.js";
import sendEmail from "../../utils/sendEmail.js";
import renderResetEmail from "../emails/renderResetEmail.js";

import authCookieOptions, {
  withMaxAge as withCookieMaxAge,
} from "../../utils/cookieOptions.js";

import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// pickClientBaseUrl()
// ---------------------------------------------------------------------------
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

function nowPlus(ms) {
  return new Date(Date.now() + ms);
}

// ---------------------------------------------------------------------------
// nodemailer fallback
// ---------------------------------------------------------------------------
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
      "[authController/mail] Missing SMTP config; using streamTransport (DEV preview)."
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
  await transporter.sendMail({ from, to, subject, text, html });
}

// ---------------------------------------------------------------------------
// Robust User model loader (CJS/ESM, repo-layout tolerant)
// ---------------------------------------------------------------------------
async function getUserModel() {
  const candidates = [
    "../../models/User.cjs",
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
      const mod = ns?.default ?? ns;
      if (mod) return mod;
    } catch {
      /* try next */
    }
  }

  console.error("[getUserModel] FAILED to load User model.");
  return null;
}

// ---------------------------------------------------------------------------
// safeUserOut – shared sanitizer
// ---------------------------------------------------------------------------
function safeUserOut(userDocOrLean) {
  if (!userDocOrLean) return null;
  const u =
    typeof userDocOrLean.toObject === "function"
      ? userDocOrLean.toObject()
      : { ...userDocOrLean };

  delete u.password;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;

  if (!Array.isArray(u.extraImages)) {
    u.extraImages = u.extraImages ? [u.extraImages].filter(Boolean) : [];
  }
  if (!Array.isArray(u.photos)) {
    u.photos = Array.isArray(u.extraImages) ? [...u.extraImages] : [];
  }

  if (!u.billing || typeof u.billing !== "object") {
    u.billing = {};
  }
  const nestedCid = u.billing.stripeCustomerId || null;
  const topCid = u.stripeCustomerId || null;
  const effectiveCid = nestedCid || topCid || null;

  u.billing.stripeCustomerId = effectiveCid;
  u.stripeCustomerId = effectiveCid;

  u.isPremium = !!u.isPremium;
  u.premium = !!u.premium;

  return u;
}

// ---------------------------------------------------------------------------
// Local fallback JWT helpers
// ---------------------------------------------------------------------------
function signAccessToken(payload = {}) {
  const secret =
    process.env.JWT_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    "dev_access_secret";
  const ttl = process.env.JWT_EXPIRES_IN || "2h";
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

function signRefreshToken(payload = {}) {
  const secret =
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    "dev_refresh_secret";
  const ttl = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

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
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
export async function login(req, res) {
  try {
    const emailRaw = req?.body?.email || req?.body?.username || "";
    const password = req?.body?.password || "";
    const email = String(emailRaw).trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const User = await getUserModel();

    let userDoc = null;
    if (typeof User.findByCredentials === "function") {
      userDoc = await User.findByCredentials(email, password);
    } else {
      userDoc = await User.findOne({ email }).exec();
      if (!userDoc)
        return res.status(401).json({ error: "Invalid email or password." });
    }

    const userOut = safeUserOut(userDoc);

    const rawId = userOut._id || userDoc._id;
    const userId = String(rawId);
    const payload = {
      sub: userId,
      id: userId,
      userId,
      uid: userId,
      email: userOut.email,
      isPremium: !!userOut.isPremium,
      role: userOut.role || "user",
    };

    let accessToken = null;
    let refreshToken = null;

    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(payload);
        accessToken = issued?.accessToken;
        refreshToken = issued?.refreshToken;
      }
    } catch {}

    if (!accessToken && typeof utilSignAccessToken === "function") {
      accessToken = utilSignAccessToken(payload);
    }
    if (!refreshToken && typeof utilSignRefreshToken === "function") {
      refreshToken = utilSignRefreshToken(payload);
    }

    if (!accessToken) accessToken = signAccessToken(payload);
    if (!refreshToken)
      refreshToken = signRefreshToken({ ...payload, type: "refresh" });

    try {
      res.cookie(
        "refreshToken",
        refreshToken,
        withCookieMaxAge(
          Number(process.env.REFRESH_TOKEN_MAX_AGE_MS) ||
            30 * 24 * 60 * 60 * 1000
        )
      );
    } catch {}

    return res.status(200).json({
      message: "Login successful.",
      user: userOut,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "Unexpected error while logging in." });
  }
}

// ---------------------------------------------------------------------------
// REFRESH
// ---------------------------------------------------------------------------
export async function refresh(req, res) {
  try {
    const bodyToken =
      typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";

    const bearerToken =
      typeof req.headers?.authorization === "string"
        ? req.headers.authorization.replace(/Bearer\s+/i, "").trim()
        : "";

    let cookieToken =
      req.cookies?.refreshToken ||
      req.cookies?.refresh_token ||
      req.cookies?.jwt ||
      req.cookies?.jid ||
      req.cookies?.token ||
      "";

    if (!cookieToken && req.headers?.cookie) {
      const parts = req.headers.cookie.split(";").map((p) => p.trim());
      for (const name of [
        "refreshToken",
        "refresh_token",
        "jwt",
        "jid",
        "token",
      ]) {
        const prefix = `${name}=`;
        const found = parts.find((p) => p.startsWith(prefix));
        if (found) cookieToken = found.slice(prefix.length);
      }
    }

    let token = (bodyToken || bearerToken || cookieToken || "").trim();
    if (!token) return res.status(401).json({ error: "Refresh token is required." });

    let decoded = null;
    let verifiedBy = null;

    if (typeof utilVerifyRefreshToken === "function") {
      const utilRes = utilVerifyRefreshToken(token);
      if (utilRes?.ok && utilRes?.decoded) {
        decoded = utilRes.decoded;
        verifiedBy = "util";
      }
    }

    if (!decoded) {
      const secret =
        process.env.JWT_REFRESH_SECRET ||
        process.env.REFRESH_TOKEN_SECRET ||
        "dev_refresh_secret";
      try {
        decoded = jwt.verify(token, secret);
        verifiedBy = "local";
      } catch {
        return res
          .status(401)
          .json({ error: "Invalid or expired refresh token." });
      }
    }

    const decodedId =
      decoded?.sub ||
      decoded?.userId ||
      decoded?.uid ||
      decoded?.id ||
      decoded?._id ||
      "";
    if (!decodedId)
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token." });

    const User = await getUserModel();
    const userDoc = await User.findById(decodedId);
    if (!userDoc)
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token." });

    const userOut = safeUserOut(userDoc);

    const userId = String(userDoc._id);
    const payload = {
      sub: userId,
      id: userId,
      userId,
      uid: userId,
      email: userOut.email,
      isPremium: !!userOut.isPremium,
      role: userOut.role || "user",
    };

    let accessToken = null;
    let refreshToken = null;

    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(payload);
        accessToken = issued?.accessToken;
        refreshToken = issued?.refreshToken;
      }
    } catch {}

    if (!accessToken && typeof utilSignAccessToken === "function") {
      accessToken = utilSignAccessToken(payload);
    }
    if (!refreshToken && typeof utilSignRefreshToken === "function") {
      refreshToken = utilSignRefreshToken(payload);
    }

    if (!accessToken) accessToken = signAccessToken(payload);
    if (!refreshToken)
      refreshToken = signRefreshToken({ ...payload, type: "refresh" });

    try {
      res.cookie(
        "refreshToken",
        refreshToken,
        withCookieMaxAge(
          Number(process.env.REFRESH_TOKEN_MAX_AGE_MS) ||
            30 * 24 * 60 * 60 * 1000
        )
      );
    } catch {}

    return res.status(200).json({
      message: "Token refreshed.",
      user: userOut,
      accessToken,
      refreshToken,
      verifiedBy,
    });
  } catch (err) {
    console.error("[auth/refresh]", err);
    return res.status(500).json({ error: "Unexpected error during refresh." });
  }
}

// ---------------------------------------------------------------------------
// me
// ---------------------------------------------------------------------------
export async function me(req, res) {
  try {
    const hintedId =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId ||
      req.user?.sub ||
      "";

    const authHeader = req.headers?.authorization || "";
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    if (!token && hintedId) {
      const User = await getUserModel();
      const userDoc = await User.findById(hintedId).select("+rewind");
      if (!userDoc) return res.status(404).json({ error: "User not found." });
      return res.status(200).json(normalizeUserOut(userDoc));
    }

    let decoded = null;
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

    if (!finalId)
      return res.status(401).json({ error: "No user id in token." });

    const User = await getUserModel();
    const userDoc = await User.findById(finalId).select("+rewind");
    if (!userDoc) return res.status(404).json({ error: "User not found." });

    return res.status(200).json(normalizeUserOut(userDoc));
  } catch (err) {
    console.error("[auth/me]", err);
    return res.status(500).json({ error: "Unexpected error in /auth/me." });
  }
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
export async function logout(_req, res) {
  return res.status(200).json({ message: "Logged out." });
}

// ---------------------------------------------------------------------------
// verifyEmail (REAL IMPLEMENTATION, WITH getUserModel)
// ---------------------------------------------------------------------------
export async function verifyEmail(req, res) {
  try {
    const token = (req.query?.token || req.body?.token || "").trim();
    const id = (req.query?.id || req.body?.id || "").trim();

    if (!token || !id)
      return res.status(400).json({ error: "Invalid verification link." });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const User = await getUserModel();
    const user = await User.findById(id).select(
      "+emailVerifyToken +emailVerifyExpires"
    );

    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.emailVerifiedAt) {
      return res.status(200).json({
        message: "Email is already verified.",
        emailVerified: true,
        user: normalizeUserOut(user),
      });
    }

    if (!user.emailVerifyToken || user.emailVerifyToken !== hashed) {
      return res.status(400).json({ error: "Invalid verification link." });
    }

    if (user.emailVerifyExpires < Date.now()) {
      return res.status(400).json({ error: "Verification link has expired." });
    }

    user.emailVerifiedAt = new Date();
    user.emailVerifyToken = null;
    user.emailVerifyExpires = null;
    await user.save();

    return res.status(200).json({
      message: "Email verified successfully.",
      emailVerified: true,
      emailVerifiedAt: user.emailVerifiedAt,
      user: normalizeUserOut(user),
    });
  } catch (err) {
    console.error("[verifyEmail]", err);
    return res.status(500).json({ error: "Server error." });
  }
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
export async function register(req, res) {
  try {
    const rawEmail = req?.body?.email || "";
    const email = String(rawEmail).trim().toLowerCase();
    const password = (req?.body?.password || "").trim();
    const username =
      (req?.body?.username || req?.body?.name || "").trim() ||
      email.split("@")[0];

    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });

    const User = await getUserModel();
    const existing = await User.findOne({ email }).lean();
    if (existing)
      return res.status(409).json({ error: "User with this email already exists." });

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

    let accessToken = null;
    let refreshToken = null;

    try {
      if (typeof issueTokens === "function") {
        const issued = await issueTokens(payload);
        accessToken = issued?.accessToken;
        refreshToken = issued?.refreshToken;
      }
    } catch {}

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
    console.error("[auth/register]", err);
    return res.status(500).json({ error: "Unexpected error during registration." });
  }
}

// ---------------------------------------------------------------------------
// EXPORT DEFAULT
// ---------------------------------------------------------------------------
// ─────────────────────────────────────────────────────────────
// TEMP: safe stub so server can start even if forgotPassword
// and resetPassword are not fully implemented yet.
// ─────────────────────────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    return res.status(501).json({
      error: "forgotPassword is not implemented in this build",
    });
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    return res.status(501).json({
      error: "resetPassword is not implemented in this build",
    });
  } catch (err) {
    return next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────
const controller = {
  login,
  register,
  refresh,
  forgotPassword,
  resetPassword,
  logout,
  verifyEmail,
  me,
};

export default controller;
