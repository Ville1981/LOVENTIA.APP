// PATH: server/controllers/userController.js

// --- REPLACE START: controller consolidated to use ONE normalizer, avoid field cutting, and keep structure close to original ---
/**
 * User Controller
 * -----------------------------------------------------------------------------
 * Updates in this version:
 *  - Uses the single shared normalizer from ../utils/normalizeUserOut.js
 *  - Avoids any .select("...") that cuts fields (we only exclude password where needed)
 *  - Realistic forgot/reset password flow with email helper (env-configured)
 *  - Visibility helpers (hide/unhide) and auto-unhide on login
 *  - Image handlers keep `photos` and `extraImages` mirrored and paths normalized
 *  - All comments in English; spelling reviewed
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import nodemailer from "nodemailer";

// ✅ Unified outbound normalizer (single source of truth)
import normalizeUserOutUtil, {
  normalizeUsersOut as _normalizeUsersOutUtil,
} from "../utils/normalizeUserOut.js";

// Models (ESM/CJS interop safe)
import * as UserModule from "../models/User.js";
const User = UserModule?.default || UserModule;

/* -----------------------------------------------------------------------------
 * Cookie options for refresh token
 * --------------------------------------------------------------------------- */
const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/** Returns the first defined (non-empty) value */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

/**
 * Lazy service loader – tolerates different folder layouts.
 * Tries several base paths; caches the first set it finds.
 * (Keeps close to original size/shape while making controller resilient.)
 */
let _servicesCache = null;
/** @returns {Promise<Record<string, Function>>} */
async function loadServices() {
  if (_servicesCache) return _servicesCache;

  const bases = ["../services", "./services", "../api/services", "../src/services"];
  const result = {};
  for (const base of bases) {
    try {
      // auth.service
      if (!result.registerUserService || !result.loginUserService) {
        const authMod = await import(new URL(`${base}/auth.service.js`, import.meta.url)).catch(
          () => null
        );
        if (authMod) {
          result.registerUserService =
            authMod.registerUserService || authMod.default?.registerUserService;
          result.loginUserService = authMod.loginUserService || authMod.default?.loginUserService;
        }
      }
      // profile.service
      if (
        !result.getMeService ||
        !result.updateProfileService ||
        !result.getMatchesWithScoreService ||
        !result.upgradeToPremiumService
      ) {
        const profMod = await import(new URL(`${base}/profile.service.js`, import.meta.url)).catch(
          () => null
        );
        if (profMod) {
          result.getMeService = profMod.getMeService || profMod.default?.getMeService;
          result.updateProfileService =
            profMod.updateProfileService || profMod.default?.updateProfileService;
          result.getMatchesWithScoreService =
            profMod.getMatchesWithScoreService || profMod.default?.getMatchesWithScoreService;
          result.upgradeToPremiumService =
            profMod.upgradeToPremiumService || profMod.default?.upgradeToPremiumService;
        }
      }
      // images.service
      if (
        !result.uploadExtraPhotosService ||
        !result.uploadPhotoStepService ||
        !result.deletePhotoSlotService
      ) {
        const imgMod = await import(new URL(`${base}/images.service.js`, import.meta.url)).catch(
          () => null
        );
        if (imgMod) {
          result.uploadExtraPhotosService =
            imgMod.uploadExtraPhotosService || imgMod.default?.uploadExtraPhotosService;
          result.uploadPhotoStepService =
            imgMod.uploadPhotoStepService || imgMod.default?.uploadPhotoStepService;
          result.deletePhotoSlotService =
            imgMod.deletePhotoSlotService || imgMod.default?.deletePhotoSlotService;
        }
      }
    } catch {
      // Keep trying other bases, do not break the app if one fails
    }
  }

  _servicesCache = result;
  return result;
}

/* --------------------------------- helpers ---------------------------------- */
/** Safe unlink (no-throw) */
function removeFileSafe(filePath) {
  try {
    if (!filePath || typeof filePath !== "string") return;
    const absolute = path.resolve(filePath);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("removeFileSafe warning:", e?.message || e);
  }
}

/** Build minimal JWT payload */
function buildJwtPayload(user) {
  return { id: String(user._id), role: user.role || "user" };
}

/* -----------------------------------------------------------------------------
 * Nodemailer transporter (config via env)
 * --------------------------------------------------------------------------- */
function buildTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    // eslint-disable-next-line no-console
    console.warn("[mail] SMTP_USER/SMTP_PASS missing. Emails will fail in production.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

/** Send email helper */
async function sendMail({ to, subject, text, html }) {
  const transporter = buildTransporter();
  const from = process.env.MAIL_FROM || `No-Reply <no-reply@localhost>`;
  return transporter.sendMail({ from, to, subject, text, html });
}

// --- REPLACE START: outbound normalizer (delegate to utils) ---
/** Normalize path to web path */
function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = p.replace(/\\/g, "/");
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) s = `/${s}`;
  return s;
}

/** Local wrapper around shared normalizer with safe fallback */
function normalizeUserOut(u) {
  try {
    return normalizeUserOutUtil(u);
  } catch {
    if (!u) return u;
    const plain = typeof u.toObject === "function" ? u.toObject() : { ...u };

    const photosIn = Array.isArray(plain.photos) ? plain.photos : null;
    const extraIn = Array.isArray(plain.extraImages) ? plain.extraImages : null;

    let canonical = photosIn || extraIn || [];
    if (photosIn && extraIn && extraIn.length > photosIn.length) canonical = extraIn;

    const normalizedList = (canonical || []).filter(Boolean).map(toWebPath);
    plain.photos = normalizedList;
    plain.extraImages = normalizedList;

    if (plain.profilePicture) plain.profilePicture = toWebPath(plain.profilePicture);
    if (plain.profilePhoto) plain.profilePhoto = toWebPath(plain.profilePhoto);

    // Ensure nested + flat location both exist for client compatibility
    const loc = plain.location && typeof plain.location === "object" ? plain.location : {};
    plain.country = plain.country || loc.country || null;
    plain.region = plain.region || loc.region || null;
    plain.city = plain.city || loc.city || null;
    plain.location = {
      country: plain.country || null,
      region: plain.region || null,
      city: plain.city || null,
    };

    return plain;
  }
}

function normalizeUsersOut(arr) {
  try {
    if (typeof _normalizeUsersOutUtil === "function") return _normalizeUsersOutUtil(arr);
  } catch {}
  return Array.isArray(arr) ? arr.map(normalizeUserOut) : [];
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Auth / Account
────────────────────────────────────────────────────────────────────────────── */

export async function registerUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.registerUserService === "function") {
    return sv.registerUserService(req, res);
  }
  try {
    const { email, password, username } = req.body || {};
    if (!email || !password || !username) {
      return res.status(400).json({ error: "Username, email and password are required." });
    }

    const normEmail = String(email).toLowerCase().trim();
    const normUsername = String(username).trim();

    const existing = await User.findOne({
      $or: [{ email: normEmail }, { username: normUsername }],
    });
    if (existing) {
      const field = existing.email === normEmail ? "Email" : "Username";
      return res.status(409).json({ error: `${field} already in use.` });
    }

    const saltRounds = parseInt(process.env.SALT_ROUNDS || "10", 10);
    const hashed = await bcrypt.hash(password, saltRounds);
    const user = await User.create({ email: normEmail, password: hashed, username: normUsername });

    return res
      .status(201)
      .json({ user: { id: user._id, email: user.email, username: user.username } });
  } catch (err) {
    console.error("registerUser fallback error:", err);
    if (err?.code === 11000) {
      const key = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({ error: `${key} already in use.` });
    }
    return res.status(500).json({ error: "Registration failed." });
  }
}

export async function loginUser(req, res) {
  const sv = await loadServices();
  if (typeof sv.loginUserService === "function") {
    return sv.loginUserService(req, res, { refreshCookieOptions });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials." });

    // --- Auto-unhide-on-login (also sync visibility.*) ---
    try {
      const now = new Date();
      const hidden = Boolean(user.hidden || user.isHidden);
      const until = user.hiddenUntil ? new Date(user.hiddenUntil) : null;
      const resume = user.resumeOnLogin === true || user.visibility?.resumeOnLogin === true;

      if (hidden) {
        const shouldUnhideByTime = until && now >= until;
        const shouldUnhideByFlag = resume && (!until || now >= until);
        if (shouldUnhideByTime || shouldUnhideByFlag) {
          user.hidden = false;
          user.isHidden = false;
          user.hiddenUntil = undefined;
          try {
            if (!user.visibility || typeof user.visibility !== "object") user.visibility = {};
            user.visibility.isHidden = false;
            user.visibility.hiddenUntil = undefined;
          } catch {}
          await user.save().catch(() => {});
        }
      }
    } catch {}

    const payload = buildJwtPayload(user);

    const accessSecret =
      pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET) ||
      "dev_jwt_secret";
    const refreshSecret =
      pickFirstDefined(process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_SECRET) ||
      "dev_refresh_secret";

    const accessToken = jwt.sign(payload, accessSecret, {
      expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
    });
    const refreshToken = jwt.sign(payload, refreshSecret, {
      expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
    });

    if (typeof res.cookie === "function")
      res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, username: user.username, role: user.role || "user" },
    });
  } catch (err) {
    console.error("loginUser fallback error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Password reset: forgot + reset (real email sending)
────────────────────────────────────────────────────────────────────────────── */

export async function forgotPassword(req, res) {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email });
    const genericResponse = {
      message: "If an account exists for that email, a reset link has been sent.",
    };

    if (!user) return res.status(200).json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const ttlMinutes = parseInt(process.env.RESET_TOKEN_TTL_MIN || "30", 10);
    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await user.save();

    const appName = process.env.APP_NAME || "Loventia";
    const baseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5174";
    const resetUrl = `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;
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
      console.error("[mail] Failed to send reset email:", mailErr?.message || mailErr);
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ error: "Failed to process request." });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password)
      return res.status(400).json({ error: "Token and new password are required." });

    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const now = new Date();

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: now },
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token." });

    const saltRounds = parseInt(process.env.SALT_ROUNDS || "10", 10);
    user.password = await bcrypt.hash(password, saltRounds);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    try {
      if (typeof res.clearCookie === "function") {
        res.clearCookie("refreshToken", {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    } catch {}

    return res.status(200).json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Profile
────────────────────────────────────────────────────────────────────────────── */

/**
 * Treat placeholder-ish strings as empty (so they clear the field).
 * NOTE: intentionally **does not** include "none" as a placeholder anymore
 * so values like pets="none" are stored as real choices.
 */
function isPlaceholderString(v) {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (
    s === "" ||
    s === "select" ||
    s === "choose" ||
    s === "valitse" ||
    /* intentionally removed: s === "none", */
    s === "n/a" ||
    s === "-" ||
    s === "—"
  );
}

export async function getMe(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMeService === "function") return sv.getMeService(req, res);
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id)))
      return res.status(401).json({ error: "Unauthorized" });
    // Exclude only password to avoid field trimming
    const user = await User.findById(String(id)).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("getMe fallback error:", err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
}

/**
 * GET /api/users/profile
 * Returns the full profile of the current user (minus password).
 * Mirrors getMe but ensures FE receives all editable profile fields.
 */
export async function getProfile(req, res) {
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await User.findById(String(id)).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateProfile(req, res) {
  const sv = await loadServices();
  if (typeof sv.updateProfileService === "function") return sv.updateProfileService(req, res);
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id)))
      return res.status(401).json({ error: "Unauthorized" });

    // ✅ Map legacy `ideology` → `politicalIdeology` BEFORE applying patch
    if (
      (req.body?.politicalIdeology === undefined ||
        req.body?.politicalIdeology === null ||
        isPlaceholderString(req.body?.politicalIdeology)) &&
      typeof req.body?.ideology !== "undefined"
    ) {
      req.body.politicalIdeology = req.body.ideology;
    }

    const allowed = [
      "username",
      "email",
      "summary",
      "gender",
      "orientation",
      "goal",
      "lookingFor",
      "age",
      "height",
      "heightUnit",
      "weight",
      "weightUnit",
      "city",
      "region",
      "country",
      "customCity",
      "customRegion",
      "customCountry",
      "profession",
      "professionCategory",
      "education",
      "religion",
      "religionImportance",
      "children",
      "pets",
      "nutritionPreferences", // diet
      "activityLevel",        // exercise
      "healthInfo",
      "smoke",
      "drink",
      "drugs",
      "latitude",
      "longitude",
      "profilePhoto",
      "extraImages",
      "politicalIdeology",
      "location",
      "name",
      "bodyType",
      "preferredGender",
      "preferredMinAge",
      "preferredMaxAge",
      "preferredInterests",
      "interests",
      "status",
      // visibility fields
      "hidden",
      "hiddenUntil",
      "resumeOnLogin",
    ];

    const patch = {};
    for (const k of allowed) {
      if (k in (req.body || {})) patch[k] = req.body[k];
    }

    // Backward compatible location patching (flat ↔ nested)
    patch.location = patch.location || {};
    for (const key of ["country", "region", "city"]) {
      if (req.body && key in req.body) patch.location[key] = req.body[key];
      if (req.body && `location.${key}` in req.body)
        patch.location[key] = req.body[`location.${key}`];
    }
    const user = await User.findById(String(id));
    if (!user) return res.status(404).json({ error: "User not found" });

    // allow clearing fields with null / placeholders / empty strings
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || isPlaceholderString(v)) {
        if (Array.isArray(user[k])) user[k] = [];
        else user[k] = undefined;
      } else if (typeof v === "string" && v.trim() === "") {
        user[k] = undefined;
      } else {
        user[k] = v;
      }
    }

    // --- Mirror photos <-> extraImages consistently; ensure slot-0 = profilePicture ---
    try {
      const arr = Array.isArray(user.extraImages)
        ? user.extraImages
        : Array.isArray(user.photos)
          ? user.photos
          : [];
      const cleaned = Array.from(new Set((arr || []).filter(Boolean).map(toWebPath)));
      user.extraImages = cleaned;
      user.photos = [...cleaned];
      const slot0 = cleaned[0] || undefined;
      if (!user.profilePicture || (slot0 && toWebPath(user.profilePicture) !== toWebPath(slot0))) {
        user.profilePicture = slot0;
      }
    } catch {}

    const saved = await user.save();
    // ✅ Return a normalized user object (not wrapped)
    return res.json(normalizeUserOut(saved));
  } catch (err) {
    console.error("updateProfile fallback error:", err);
    return res.status(500).json({ error: "Profile update failed" });
  }
}

export async function upgradeToPremium(req, res) {
  const sv = await loadServices();
  if (typeof sv.upgradeToPremiumService === "function") return sv.upgradeToPremiumService(req, res);
  return res.status(501).json({ error: "Not implemented (premium service missing)" });
}

export async function getMatchesWithScore(req, res) {
  const sv = await loadServices();
  if (typeof sv.getMatchesWithScoreService === "function")
    return sv.getMatchesWithScoreService(req, res);
  return res.status(501).json({ error: "Not implemented (matches service missing)" });
}

/* ──────────────────────────────────────────────────────────────────────────────
   Images
────────────────────────────────────────────────────────────────────────────── */

/** Multer path → web path (/uploads/xxx.jpg) */
function toWebPathStrict(p) {
  if (!p) return "";
  const s = String(p).replace(/\\/g, "/").replace(/^\/?/, "");
  return `/${s}`;
}
/** Web path → absolute FS path */
function absFromWebPath(webPath) {
  const clean = String(webPath || "").replace(/^\//, "");
  return path.resolve(process.cwd(), clean);
}
/** Resolve target user (params.id preferred) */
async function getTargetUser(req) {
  const id = req.params?.id || req.user?._id || req.user?.id || req.user?.userId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    const e = new Error("User id not provided or invalid");
    e.status = 400;
    throw e;
  }
  const user = await User.findById(String(id));
  if (!user) {
    const e = new Error("User not found");
    e.status = 404;
    throw e;
  }
  return user;
}
/** Unified images success payload (includes normalized user) */
function sendImagesOk(res, user) {
  const normalized = normalizeUserOut(user);
  const list = Array.isArray(normalized.extraImages) ? normalized.extraImages : [];
  const avatar =
    normalized.profilePicture || (Array.isArray(normalized.photos) && normalized.photos[0]) || null;

  return res.status(200).json({
    user: normalized,
    photos: normalized.photos || list,
    extraImages: list,
    profilePicture: avatar || null,
  });
}

/* Upload multiple extra photos (merge + mirror + optional avatar sync) */
export async function uploadExtraPhotos(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadExtraPhotosService === "function") {
    return sv.uploadExtraPhotosService(req, res);
  }
  try {
    const user = await getTargetUser(req);
    const files = Array.isArray(req.files) ? req.files : req.files?.photos || [];
    const picked = (files || []).filter(Boolean);
    if (!picked.length) return res.status(400).json({ message: "No files uploaded" });

    const newPaths = picked.map((f) => toWebPathStrict(f.path || f.filename || ""));
    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];

    const prevZero = user.extraImages[0] || null;

    const merged = Array.from(new Set([...user.extraImages, ...newPaths].filter(Boolean)));
    user.extraImages = merged;

    user.photos = [...user.extraImages];

    const newZero = user.extraImages[0] || null;
    if (
      newZero &&
      (
        !user.profilePicture ||
        toWebPathStrict(user.profilePicture) !== toWebPathStrict(newZero)
      ) &&
      newZero !== prevZero
    ) {
      user.profilePicture = newZero;
    }

    await user.save();
    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || "Upload failed" });
  }
}

/* Upload/replace single photo at index/slot (mirror + avatar sync) */
export async function uploadPhotoStep(req, res) {
  const sv = await loadServices();
  if (typeof sv.uploadPhotoStepService === "function") {
    return sv.uploadPhotoStepService(req, res);
  }
  try {
    const user = await getTargetUser(req);

    let file = null;
    if (req.file) {
      file = req.file;
    } else if (Array.isArray(req.files) && req.files[0]) {
      file = req.files[0];
    } else if (req.files && Array.isArray(req.files.photos) && req.files.photos[0]) {
      file = req.files.photos[0];
    }

    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Support both names and locations: :slot, index, slot
    const idxRaw =
      req.params?.slot ?? req.query?.index ?? req.body?.index ?? req.query?.slot ?? req.body?.slot;

    const index =
      idxRaw !== undefined && idxRaw !== null && idxRaw !== "" ? Number(idxRaw) : null;

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    const webPath = toWebPathStrict(file.path || file.filename || "");

    const prevZero = user.extraImages[0] || null;

    if (Number.isInteger(index) && index >= 0) {
      const prev = user.extraImages[index];
      user.extraImages[index] = webPath;
      if (prev && prev !== webPath) {
        const absPrev = absFromWebPath(prev);
        fs.promises.unlink(absPrev).catch(() => {});
      }
    } else {
      if (!user.extraImages.includes(webPath)) user.extraImages.push(webPath);
    }

    user.extraImages = (user.extraImages || []).filter(Boolean);
    user.photos = [...user.extraImages];

    const newZero = user.extraImages[0] || null;
    if (
      newZero &&
      (
        !user.profilePicture ||
        toWebPathStrict(user.profilePicture) !== toWebPathStrict(newZero)
      ) &&
      (Number.isInteger(index) ? index === 0 : newZero !== prevZero)
    ) {
      user.profilePicture = newZero;
    }

    await user.save();
    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || "Upload step failed" });
  }
}

/*
 * Delete one photo by slot/index (accept both names) or by exact path.
 * Mirrors photos <-> extraImages and updates profilePicture when slot 0 is removed.
 */
export async function deletePhotoSlot(req, res) {
  const sv = await loadServices();
  if (typeof sv.deletePhotoSlotService === "function") {
    return sv.deletePhotoSlotService(req, res);
  }
  try {
    const user = await getTargetUser(req);

    user.extraImages = Array.isArray(user.extraImages) ? user.extraImages : [];
    user.photos = Array.isArray(user.photos) ? user.photos : [...user.extraImages];

    // ✅ Accept slot/index from multiple places and under both names
    const idxRaw =
      req.params?.slot ??
      req.query?.index ??
      req.body?.index ??
      req.query?.slot ??
      req.body?.slot;

    const pathRaw = req.query?.path ?? req.body?.path;

    // Keep previous slot-0 for avatar adjustment
    const prevZero = (user.extraImages[0] ?? user.photos[0]) || null;

    let removed;
    let removedIndex = -1;

    if (idxRaw !== undefined && idxRaw !== null && idxRaw !== "") {
      const i = Number(idxRaw);
      if (!Number.isInteger(i) || i < 0) {
        return res.status(400).json({ message: "Invalid index" });
      }
      if (i >= Math.max(user.extraImages.length, user.photos.length)) {
        return res.status(400).json({ message: "Index out of bounds" });
      }

      // Remove from both arrays symmetrically (if present)
      if (i < user.extraImages.length) {
        removed = user.extraImages.splice(i, 1)[0];
      }
      if (i < user.photos.length) {
        // If extraImages and photos diverged, ensure we remove the matching index from photos too
        const removedPhotos = user.photos.splice(i, 1)[0];
        if (!removed && removedPhotos) removed = removedPhotos;
      }
      removedIndex = i;
    } else if (pathRaw) {
      const web = toWebPathStrict(pathRaw);

      // Try match in extraImages first
      let i = user.extraImages.findIndex((p) => toWebPathStrict(p) === web);
      if (i !== -1) {
        removed = user.extraImages.splice(i, 1)[0];
        removedIndex = i;
        // Keep photos mirrored: remove same index if available, otherwise remove matching path
        if (i < user.photos.length) user.photos.splice(i, 1);
        else {
          const j = user.photos.findIndex((p) => toWebPathStrict(p) === web);
          if (j !== -1) user.photos.splice(j, 1);
        }
      } else {
        // Try photos if not found above
        const j = user.photos.findIndex((p) => toWebPathStrict(p) === web);
        if (j === -1) return res.status(404).json({ message: "Image not found" });
        removed = user.photos.splice(j, 1)[0];
        removedIndex = j;
        // Remove same from extraImages by index or by path if diverged
        if (j < user.extraImages.length) user.extraImages.splice(j, 1);
        else {
          const k = user.extraImages.findIndex((p) => toWebPathStrict(p) === web);
          if (k !== -1) user.extraImages.splice(k, 1);
        }
      }
    } else {
      return res.status(400).json({ message: "Provide index/slot or path to delete" });
    }

    // Clean falsy entries and ensure mirror: photos = extraImages
    user.extraImages = (user.extraImages || []).filter(Boolean);
    user.photos = [...user.extraImages];

    // ✅ If slot-0 was removed, point avatar to new slot-0 or clear it
    const newZero = user.extraImages[0] || undefined;
    const removedWasZero =
      removedIndex === 0 ||
      (removed && prevZero && toWebPathStrict(removed) === toWebPathStrict(prevZero));

    if (removedWasZero) {
      user.profilePicture = newZero || undefined;
    }

    await user.save();

    // Best-effort delete the removed file from disk (if stored locally)
    if (removed) {
      const abs = absFromWebPath(removed);
      fs.promises.unlink(abs).catch(() => {});
    }

    // Return normalized user or { user: normalize(...) } – we include both shapes via helper
    return sendImagesOk(res, user);
  } catch (err) {
    if (!err.status) err.status = 500;
    return res.status(err.status).json({ message: err.message || "Delete failed" });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Delete my account (cascade) – DELETE /api/users/me
────────────────────────────────────────────────────────────────────────────── */

export async function deleteMeUser(req, res) {
  try {
    const uid =
      req.user?.id ||
      req.user?._id ||
      req.user?.userId ||
      req.auth?.userId ||
      req.auth?.id;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid)))
      return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: "User not found" });

    let removedFiles = 0;
    try {
      if (user.profilePicture) {
        removeFileSafe(user.profilePicture);
        removedFiles += 1;
      }
      if (Array.isArray(user.extraImages)) {
        for (const p of user.extraImages) {
          removeFileSafe(p);
          removedFiles += 1;
        }
      }
    } catch (e) {
      console.warn("deleteMeUser file cleanup warning:", e?.message || e);
    }

    let deletedMessages = 0;
    try {
      const MsgModule = await import("../models/Message.js").catch(() => null);
      const Message = MsgModule?.default || MsgModule;
      if (Message && typeof Message.deleteMany === "function") {
        const r1 = await Message.deleteMany({ sender: String(uid) });
        const r2 = await Message.deleteMany({ receiver: String(uid) });
        const r3 = await Message.deleteMany({ participants: String(uid) }).catch(
          () => ({ deletedCount: 0 })
        );
        deletedMessages =
          (r1?.deletedCount || 0) + (r2?.deletedCount || 0) + (r3?.deletedCount || 0);
      }
    } catch (e) {
      console.warn("deleteMeUser message cleanup skipped:", e?.message || e);
    }

    await User.findByIdAndDelete(String(uid));

    try {
      if (typeof res.clearCookie === "function") {
        res.clearCookie("refreshToken", {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    } catch {}

    res.setHeader("X-Removed-Files", String(removedFiles));
    res.setHeader("X-Deleted-Messages", String(deletedMessages));
    return res.status(204).send();
  } catch (err) {
    console.error("deleteMeUser error:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Hide / Unhide my account
   - PATCH /api/users/me/hide            (legacy/front compat)   -> hideMe
   - PATCH /api/users/me/visibility      (generic toggle)         -> setVisibilityMe
   - POST|PATCH /api/users/me/unhide     (force visible now)      -> unhideMe
   DiscoverController already hides hidden users by default.
────────────────────────────────────────────────────────────────────────────── */

// --- REPLACE START: visibility endpoints ---
export async function setVisibilityMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { hidden, minutes, resumeOnLogin } = req.body || {};
    if (typeof hidden !== "boolean") {
      return res.status(400).json({ error: 'Field "hidden" (boolean) is required.' });
    }

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hidden = hidden;
    user.isHidden = hidden;

    if (hidden) {
      const mins = Number.isFinite(+minutes)
        ? Math.max(0, Math.min(365 * 24 * 60, +minutes))
        : 0;
      user.hiddenUntil = mins > 0 ? new Date(Date.now() + mins * 60 * 1000) : undefined;
    } else {
      user.hiddenUntil = undefined;
    }

    if (typeof resumeOnLogin === "boolean") user.resumeOnLogin = resumeOnLogin;

    try {
      if (!user.visibility || typeof user.visibility !== "object") user.visibility = {};
      user.visibility.isHidden = !!user.hidden;
      user.visibility.hiddenUntil = user.hidden ? user.hiddenUntil || undefined : undefined;
      if (typeof resumeOnLogin === "boolean")
        user.visibility.resumeOnLogin = resumeOnLogin;
    } catch {}

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
    console.error("setVisibilityMe error:", err);
    return res.status(500).json({ error: "Failed to update visibility" });
  }
}

export async function hideMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const minutes = Number.isFinite(+req.body?.minutes) ? +req.body.minutes : undefined;
    const resumeOnLogin =
      typeof req.body?.resumeOnLogin === "boolean" ? req.body.resumeOnLogin : undefined;

    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hidden = true;
    user.isHidden = true;
    user.hiddenUntil =
      Number.isFinite(minutes) && minutes > 0
        ? new Date(Date.now() + Math.min(minutes, 365 * 24 * 60) * 60 * 1000)
        : undefined;

    if (typeof resumeOnLogin === "boolean") user.resumeOnLogin = resumeOnLogin;

    try {
      if (!user.visibility || typeof user.visibility !== "object") user.visibility = {};
      user.visibility.isHidden = true;
      user.visibility.hiddenUntil = user.hiddenUntil || undefined;
      if (typeof resumeOnLogin === "boolean")
        user.visibility.resumeOnLogin = resumeOnLogin;
    } catch {}

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
    console.error("hideMe error:", err);
    return res.status(500).json({ error: "Failed to hide account" });
  }
}

export async function unhideMe(req, res) {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await User.findById(String(uid));
    if (!user) return res.status(404).json({ error: "User not found" });

    user.hidden = false;
    user.isHidden = false;
    user.hiddenUntil = undefined;

    try {
      if (!user.visibility || typeof user.visibility !== "object") user.visibility = {};
      user.visibility.isHidden = false;
      user.visibility.hiddenUntil = undefined;
    } catch {}

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
    console.error("unhideMe error:", err);
    return res.status(500).json({ error: "Failed to unhide account" });
  }
}
// --- REPLACE END: visibility endpoints ---

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
  getProfile,   // ✅ full profile fetch
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
  setVisibilityMe,
  hideMe,
  unhideMe,
};
// --- REPLACE END ---
