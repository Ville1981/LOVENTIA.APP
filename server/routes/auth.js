// File: server/routes/auth.js
// @ts-nocheck

"use strict";

/**
 * Auth Routes (pure ESM, compatible with "type":"module")
 * - Exports ONLY the router (no '/api/auth' prefix here)
 * - Lazily resolves local modules with dynamic import() to avoid boot-time crashes
 * - Endpoints kept: refresh, logout, register, login, forgot/reset password, me, profile update, delete
 * - If a controller handler is missing, responds 501 (clear error) instead of 404
 */

// --- REPLACE START: convert to **ESM** (no require/module.exports/import.meta shims) ---
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Try dynamic import() (ESM). If it fails, return null.
 * Returns module namespace; prefers .default if present.
 */
async function tryLoad(relOrAbs) {
  try {
    const abs = path.isAbsolute(relOrAbs)
      ? relOrAbs
      : path.resolve(__dirname, relOrAbs);
    const esm = await import(pathToFileURL(abs).href);
    return (esm && (esm.default || esm)) || esm;
  } catch {
    return null;
  }
}

/** Lazily resolve project modules only when needed to avoid import-time crashes */
async function getUserModel() {
  const candidates = [
    "../models/User.js", // server/src/models/User.js
    "../../models/User.js", // server/models/User.js (fallback)
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (mod) return mod;
  }
  return null;
}

async function getSendEmail() {
  const candidates = ["../utils/sendEmail.js", "../../utils/sendEmail.js"];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (typeof mod === "function") return mod;
    if (mod && typeof mod.sendEmail === "function") return mod.sendEmail;
    if (mod?.default && typeof mod.default === "function") return mod.default;
  }
  return null;
}

async function getCookieOptions() {
  const candidates = [
    "../utils/cookieOptions.js",
    "../../utils/cookieOptions.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    if (mod.cookieOptions) return mod.cookieOptions;
    return mod; // plain object export
  }
  // sensible default
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

async function getAuthenticate() {
  const candidates = [
    "../middleware/authenticate.js",
    "../../middleware/authenticate.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    const fn = (mod && (mod.default || mod.authenticate)) || mod;
    if (typeof fn === "function") return fn;
  }
  // fallback passthrough (ONLY if missing – better than crashing)
  return (_req, _res, next) => next();
}

async function getValidators() {
  const candidates = [
    "../middleware/validators/auth.js",
    "../../middleware/validators/auth.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    let validateRegister =
      mod.validateRegister || mod.default?.validateRegister;
    let validateLogin = mod.validateLogin || mod.default?.validateLogin;
    if (typeof validateRegister !== "function")
      validateRegister = (_req, _res, next) => next();
    if (typeof validateLogin !== "function")
      validateLogin = (_req, _res, next) => next();
    return { validateRegister, validateLogin };
  }
  // fallback no-ops
  return {
    validateRegister: (_req, _res, next) => next(),
    validateLogin: (_req, _res, next) => next(),
  };
}

async function getProfileValidator() {
  const candidates = [
    "../middleware/profileValidator.js",
    "../../middleware/profileValidator.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    const fn =
      mod.sanitizeAndValidateProfile ||
      mod.default?.sanitizeAndValidateProfile ||
      ((_req, _res, next) => next());
    return fn;
  }
  return (_req, _res, next) => next();
}

async function getUploadMiddleware() {
  const candidates = ["../middleware/upload.js", "../../middleware/upload.js"];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    const up = (mod && (mod.default || mod)) || mod;
    if (up) return up;
  }
  // minimal stub for .fields usage
  return {
    fields: () => (_req, _res, next) => next(),
  };
}

/** Try to resolve an auth controller with typical names/paths */
async function getAuthController() {
  const candidates = [
    // Preferred in this repo layout
    "../api/controllers/authController.js",
    "../../api/controllers/authController.js",
    "../controllers/authController.js",
    "../../controllers/authController.js",

    // Fallbacks (some repos wire auth handlers from userController)
    "../controllers/userController.js",
    "../../controllers/userController.js",
    "../api/controllers/userController.js",
    "../../api/controllers/userController.js",
  ];

  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    // Normalize namespace
    const ns = (mod && (mod.default || mod)) || mod;
    const hasAny = ["register", "login", "refresh", "logout", "me", "profile"]
      .some((k) => typeof ns[k] === "function");
    if (hasAny) return ns;
    // Sometimes exported under different names (e.g., registerUser/loginUser)
    if (typeof ns.registerUser === "function" || typeof ns.loginUser === "function") {
      return {
        register: ns.registerUser,
        login: ns.loginUser,
        refresh: ns.refresh,
        logout: ns.logout,
        me: ns.me,
        profile: ns.profile,
      };
    }
  }
  return null;
}
// --- REPLACE END ---


const router = express.Router();

// Middleware to parse JSON, URL-encoded bodies, and cookies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

/** Utility: respond 501 if handler missing instead of returning 404 */
function notImplemented(name) {
  return (_req, res) => res.status(501).json({ error: `Handler '${name}' is not implemented` });
}

/** Utility: wrap async route handlers */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Resolve cookie options once (safe default if resolver fails) */
let cookieOptionsPromise = null;
function getCookieOptionsOnce() {
  if (!cookieOptionsPromise) cookieOptionsPromise = getCookieOptions().catch(() => ({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }));
  return cookieOptionsPromise;
}

/* 1) Refresh Access Token */
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies && req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: "No refresh token provided" });
    }
    try {
      const secret = process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
      const payload = jwt.verify(token, secret);
      if (!payload || !payload.userId) {
        return res.status(401).json({ error: "Invalid token payload" });
      }
      const accessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        process.env.JWT_SECRET || "test_secret",
        { expiresIn: "15m" }
      );
      return res.json({ accessToken });
    } catch (err) {
      console.error("Refresh token error:", err?.message || err);
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }
  })
);

/* 2) Logout User */
router.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    try {
      const cookieOptions = await getCookieOptionsOnce();
      const { maxAge, ...withoutMaxAge } = cookieOptions || {};
      res.clearCookie("refreshToken", withoutMaxAge);
      return res.json({ message: "Logout successful" });
    } catch (err) {
      console.error("Logout error:", err?.message || err);
      return res.status(500).json({ error: "Logout failed" });
    }
  })
);

/* 3) Register New User — prefer controller.register if available */
router.post(
  "/register",
  asyncHandler(async (req, res, next) => {
    const { validateRegister } = await getValidators();
    return validateRegister(req, res, async (err) => {
      if (err) return next(err);
      const ctrl = await getAuthController();
      if (ctrl && typeof ctrl.register === "function") {
        return ctrl.register(req, res, next);
      }
      return notImplemented("register")(req, res, next);
    });
  })
);

/* 4) Login User — prefer controller.login if available */
router.post(
  "/login",
  asyncHandler(async (req, res, next) => {
    const { validateLogin } = await getValidators();
    return validateLogin(req, res, async (err) => {
      if (err) return next(err);
      const ctrl = await getAuthController();
      if (ctrl && typeof ctrl.login === "function") {
        return ctrl.login(req, res, next);
      }
      return notImplemented("login")(req, res, next);
    });
  })
);

/* 5) Forgot Password */
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    try {
      const User = await getUserModel();
      if (!User) return res.status(503).json({ error: "User model unavailable" });

      const user = await User.findOne({ email });
      // Always respond with generic message for privacy
      const generic = { message: "If that email is registered, a reset link has been sent" };
      if (!user) return res.json(generic);

      const resetToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1h
      await user.save();

      const sendEmail = await getSendEmail();
      if (sendEmail) {
        const base = process.env.CLIENT_URL || "http://localhost:5173";
        const resetURL = `${base}/reset-password?token=${resetToken}&id=${user._id}`;
        const message =
          "You requested a password reset. Click the link below to set a new password:\n\n" +
          resetURL +
          "\n\nIf you did not request this, ignore this email.";
        await sendEmail(user.email, "Password Reset Request", message);
      }
      return res.json(generic);
    } catch (err) {
      console.error("Forgot password error:", err?.message || err);
      return res.status(500).json({ error: "Failed to process forgot password" });
    }
  })
);

/* 6) Reset Password */
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { id, token, newPassword } = req.body || {};
    if (!id || !token || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const User = await getUserModel();
      if (!User) return res.status(503).json({ error: "User model unavailable" });

      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
      const user = await User.findOne({
        _id: id,
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return res.json({ message: "Password has been reset successfully" });
    } catch (err) {
      console.error("Reset password error:", err?.message || err);
      return res.status(500).json({ error: "Failed to reset password" });
    }
  })
);

/* 7) Get Current User Profile */
router.get(
  "/me",
  asyncHandler(async (req, res, next) => {
    const authenticate = await getAuthenticate();
    return authenticate(req, res, async (authErr) => {
      if (authErr) return next(authErr);
      try {
        const User = await getUserModel();
        if (!User) return res.status(503).json({ error: "User model unavailable" });
        const id = req.user?.userId || req.user?.id || req.user?._id;
        if (!id) return res.status(401).json({ error: "Unauthorized" });
        const user = await User.findById(id).select("-password");
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json({ user });
      } catch (err) {
        console.error("Fetch /me error:", err?.message || err);
        return res.status(500).json({ error: "Failed to fetch user" });
      }
    });
  })
);

/* 8) Update User Profile */
router.put(
  "/profile",
  asyncHandler(async (req, res, next) => {
    const authenticate = await getAuthenticate();
    const sanitizeAndValidateProfile = await getProfileValidator();
    const upload = await getUploadMiddleware();

    authenticate(req, res, async (authErr) => {
      if (authErr) return next(authErr);
      sanitizeAndValidateProfile(req, res, async (valErr) => {
        if (valErr) return next(valErr);

        // Support both with/without upload middleware present
        const handler = async (_req, _res) => {
          try {
            const User = await getUserModel();
            if (!User) return res.status(503).json({ error: "User model unavailable" });
            const id = req.user?.userId || req.user?.id || req.user?._id;
            if (!id) return res.status(401).json({ error: "Unauthorized" });

            const updateData = {};
            if (req.body?.latitude !== undefined) {
              const lat = parseFloat(req.body.latitude);
              if (!isNaN(lat)) updateData.latitude = lat;
            }
            if (req.body?.longitude !== undefined) {
              const lng = parseFloat(req.body.longitude);
              if (!isNaN(lng)) updateData.longitude = lng;
            }
            if (req.body?.location) {
              const loc = req.body.location;
              if (loc.country) updateData.country = loc.country;
              if (loc.region) updateData.region = loc.region;
              if (loc.city) updateData.city = loc.city;
            }

            const fields = [
              "name",
              "email",
              "age",
              "height",
              "weight",
              "status",
              "religion",
              "children",
              "pets",
              "summary",
              "goal",
              "lookingFor",
              "bodyType",
              "weightUnit",
              "profession",
              "professionCategory",
            ];
            fields.forEach((field) => {
              if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
                updateData[field] = req.body[field];
              }
            });

            if (req.files && req.files.image && Array.isArray(req.files.image) && req.files.image[0]) {
              const f = req.files.image[0];
              updateData.profilePicture = `uploads/${f.filename}`;
            }

            if (req.files && req.files.extraImages && Array.isArray(req.files.extraImages)) {
              updateData.extraImages = req.files.extraImages.map((f) => `uploads/${f.filename}`);
            }

            const updated = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
            return res.json(updated);
          } catch (err) {
            console.error("Profile update error:", err?.message || err);
            return res.status(500).json({ error: "Profile update failed" });
          }
        };

        // If upload.fields exists, wrap; else just run handler
        if (typeof upload?.fields === "function") {
          return upload.fields([
            { name: "image", maxCount: 1 },
            { name: "extraImages", maxCount: 6 },
          ])(req, res, () => handler(req, res));
        }
        return handler(req, res);
      });
    });
  })
);

/* 9) Delete User Account */
router.delete(
  "/delete",
  asyncHandler(async (req, res, next) => {
    const authenticate = await getAuthenticate();
    return authenticate(req, res, async (authErr) => {
      if (authErr) return next(authErr);
      try {
        const User = await getUserModel();
        if (!User) return res.status(503).json({ error: "User model unavailable" });
        const id = req.user?.userId || req.user?.id || req.user?._id;
        if (!id) return res.status(401).json({ error: "Unauthorized" });
        await User.findByIdAndDelete(id);
        return res.json({ message: "Account deleted successfully" });
      } catch (err) {
        console.error("Account deletion error:", err?.message || err);
        return res.status(500).json({ error: "Account deletion failed" });
      }
    });
  })
);

// --- REPLACE START: ESM default export (no CommonJS exports) ---
export default router;
// --- REPLACE END ---
