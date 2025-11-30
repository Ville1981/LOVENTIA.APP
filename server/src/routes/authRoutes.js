// PATH: server/src/routes/authRoutes.js
// @ts-nocheck

/**
 * Auth routes (src side)
 * ======================
 *
 * IMPORTANT:
 * - This file used to define its own /register, /login, /forgot-password,
 *   /reset-password, /refresh, /logout, /verify-email and sometimes even /me.
 * - At the same time we now have the NEW, FULL ESM AUTH ROUTER at:
 *       server/routes/auth.js
 *   …which already contains: refresh, logout, register, login, forgot/reset,
 *   robust /me, profile update, delete, normalization, premium-flags, etc.
 *
 * - If BOTH of these files define the same paths, the final /__routes_api
 *   list will show multiple entries and sometimes the “older/simpler” one
 *   will answer first → that’s what we’ve been seeing.
 *
 * - To fix that, we still keep THIS file (so imports don’t break) but we make
 *   it clearly DELEGATE to the real router.
 *
 * - We keep the structure and comments, so in future you can re-enable any
 *   of the legacy endpoints here if you really need them.
 */

import express from "express";
import corsConfig from "../config/cors.js";

// --- REPLACE START: add dynamic helpers + real router import + rate limiters ---
/**
 * We still import the original controller here so old code that expected
 * `authController` to exist does not crash, but the actual routes below will
 * prefer the **real** router from ../../routes/auth.js.
 */
import authController from "../api/controllers/authController.js";

// crypto/bcrypt + dynamic User resolver were in your version — keep them
// so it stays familiar and we can re-use them if we ever enable local
// /reset-password again in THIS file.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

/**
 * New, unified in-memory rate limiters.
 * We only use the loginLimiter here; other limiters are mounted closer to
 * their domains (e.g. billingLimiter in payment routes).
 */
import { loginLimiter } from "../middleware/rateLimit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Try to load User model from common locations.
 * We keep this for backwards compatibility and for future “small patch”
 * endpoints that might get added to this src-level router.
 */
async function loadUserModel() {
  const candidates = [
    "../models/User.js", // typical: server/src/models/User.js
    "../src/models/User.js", // alt layout
    "../../models/User.js", // if this file happens to be deeper
  ];
  for (const rel of candidates) {
    try {
      const abs = path.resolve(__dirname, rel);
      const mod = await import(pathToFileURL(abs).href);
      const User = mod.default || mod.User || mod;
      if (User) {
        return User;
      }
    } catch (e) {
      // continue searching
    }
  }
  return null;
}

/**
 * 👉 THIS is the **real**, fully featured auth router we want to expose.
 * It lives at repo root routes/ so src/ and non-src/ both can reach it.
 * We will mount this *first* and let it handle all actual work.
 */
import realAuthRouter from "../../routes/auth.js";
// --- REPLACE END ---

const router = express.Router();

/**
 * Helper to mount a sub-router with a name + log.
 * We keep this pattern so the file looks like your other router files.
 */
const use = (path, r, name) => {
  if (!r || (typeof r !== "function" && typeof r.use !== "function")) {
    console.warn(`[authRoutes(src)] skipped ${name || path} (no valid router)`);
    return;
  }
  router.use(path, r);
  console.log(`[authRoutes(src)] mounted ${name || path} at ${path}`);
};

/**
 * ---------------------------------------------------------------------------
 * 1) MOUNT THE REAL ROUTER FIRST + attach login-specific rate limiter
 * ---------------------------------------------------------------------------
 *
 * We apply loginLimiter to POST /login **before** delegating to the real
 * router so that all 429 responses from login use the new unified JSON
 * shape from middleware/rateLimit.js.
 */

// --- REPLACE START: login limiter wiring + real router mount ---
/**
 * Apply loginLimiter to POST /login on this router. The middleware simply
 * forwards non-POST methods to the next handler so OPTIONS/GET etc. are
 * untouched.
 */
router.use("/login", (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "POST") {
    return next();
  }
  return loginLimiter(req, res, next);
});

// Now delegate to the real auth router which exposes the actual handlers.
use("/", realAuthRouter, "real-auth-router");
// --- REPLACE END ---

/**
 * ---------------------------------------------------------------------------
 * 2) OPTIONAL / LEGACY / FALLBACK ENDPOINTS
 * ---------------------------------------------------------------------------
 * We KEEP the old structure but we do **not** re-introduce the old /me
 * or a second reset-password that would shadow the new one.
 *
 * Instead, we only define endpoints here that:
 *  - are CORS-aware, AND
 *  - do NOT conflict with the real router, OR
 *  - explicitly return 501 to tell FE “not implemented here, see main router”.
 *
 * This way we keep the file long & readable, but safe.
 */

// Forgot password (legacy style) — leave as thin passthrough:
router.options("/forgot-password", corsConfig);
router.post("/forgot-password", corsConfig, async (req, res, next) => {
  // If controller exists and has a method → let it handle
  if (authController && typeof authController.forgotPassword === "function") {
    return authController.forgotPassword(req, res, next);
  }

  // If controller does not have it, return 501 (but do NOT 404)
  console.warn("[authRoutes(src)] forgotPassword not implemented in controller");
  return res.status(501).json({
    error:
      "forgotPassword not implemented here — handled by main /routes/auth.js",
  });
});

// Reset password (legacy style) — normalize password field:
router.options("/reset-password", corsConfig);
router.post("/reset-password", corsConfig, async (req, res, next) => {
  // --- REPLACE START: normalize password field for legacy callers ---
  if (req.body && req.body.newPassword && !req.body.password) {
    req.body.password = req.body.newPassword;
  }
  if (req.query && req.query.newPassword && !req.query.password) {
    req.query.password = req.query.newPassword;
  }
  // --- REPLACE END ---

  if (authController && typeof authController.resetPassword === "function") {
    return authController.resetPassword(req, res, next);
  }

  console.warn("[authRoutes(src)] resetPassword not implemented in controller");
  return res.status(501).json({
    error:
      "resetPassword not implemented here — handled by main /routes/auth.js",
  });
});

// Register
router.options("/register", corsConfig);
router.post("/register", corsConfig, (req, res, next) => {
  if (authController && typeof authController.register === "function") {
    return authController.register(req, res, next);
  }
  return res.status(501).json({ error: "register not implemented (src)" });
});

// Login
router.options("/login", corsConfig);
router.post("/login", corsConfig, (req, res, next) => {
  if (authController && typeof authController.login === "function") {
    return authController.login(req, res, next);
  }
  return res.status(501).json({ error: "login not implemented (src)" });
});

// Refresh
router.options("/refresh", corsConfig);
router.post("/refresh", corsConfig, (req, res, next) => {
  if (authController && typeof authController.refresh === "function") {
    return authController.refresh(req, res, next);
  }
  return res.status(501).json({ error: "refresh not implemented (src)" });
});

// Logout
router.options("/logout", corsConfig);
router.post("/logout", corsConfig, (req, res, next) => {
  if (authController && typeof authController.logout === "function") {
    return authController.logout(req, res, next);
  }
  return res.status(501).json({ error: "logout not implemented (src)" });
});

// Verify email
router.options("/verify-email", corsConfig);
router.post("/verify-email", corsConfig, (req, res, next) => {
  if (authController && typeof authController.verifyEmail === "function") {
    return authController.verifyEmail(req, res, next);
  }
  return res.status(501).json({ error: "verifyEmail not implemented (src)" });
});

/**
 * --- DO NOT re-add /me here ---
 * The real /me is now in server/routes/auth.js and it is the one that:
 *  - decodes JWT from header/cookie/query
 *  - loads user
 *  - normalizes with normalizeUserOut
 *  - adds premium flags + entitlements
 * If we added another /me here, it could sometimes answer first.
 */

export default router;



