// PATH: server/src/routes/auth.js
// @ts-nocheck

"use strict";

/**
 * Auth Routes (pure ESM, compatible with "type":"module")
 * - Exports ONLY the router (no '/api/auth' prefix here)
 * - Lazily resolves local modules with dynamic import() to avoid boot-time crashes
 * - Endpoints kept: refresh, logout, register, login, forgot/reset password, me, profile update, delete
 * - If a controller handler is missing, responds 501 (clear error) instead of 404
 */

// --- REPLACE START: convert to **ESM** + centralized (optional) CORS with safe fallbacks ---
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
// --- REPLACE END ---

// --- REPLACE START: bring in the same normalizer as /api/users/me and /api/me ---
import normalizeUserOut from "../utils/normalizeUserOut.js";
// --- REPLACE END ---

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ensure logs directory exists (for mail-*.log)
 */
function ensureLogsDir() {
  const logsDir = path.resolve(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {
      console.warn("[auth/routes] failed to create logs dir:", e?.message || e);
    }
  }
  return logsDir;
}

/**
 * write mail log helper — small, safe, no-throw
 */
function writeMailLog(line) {
  try {
    const logsDir = ensureLogsDir();
    const file = path.join(
      logsDir,
      `mail-${new Date().toISOString().slice(0, 10)}.log`
    );
    const ts = new Date().toISOString();
    fs.appendFileSync(file, `[${ts}] ${line}\n`, { encoding: "utf8" });
  } catch (e) {
    console.warn("[auth/routes] failed to write mail log:", e?.message || e);
  }
}

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
    "../src/models/User.js", // server/src/models/User.js
    "../models/User.js", // server/models/User.js
    "../../models/User.js", // defensive fallback
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (mod) return mod;
  }
  return null;
}

async function getSendEmail() {
  const candidates = [
    "../src/utils/sendEmail.js",
    "../utils/sendEmail.js",
    "../../utils/sendEmail.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;

    // plain function export
    if (typeof mod === "function") {
      console.log("[auth/routes] sendEmail resolved from", c);
      return mod;
    }
    // named export
    if (mod && typeof mod.sendEmail === "function") {
      console.log("[auth/routes] sendEmail.sendEmail resolved from", c);
      return mod.sendEmail;
    }
    // default export
    if (mod?.default && typeof mod.default === "function") {
      console.log("[auth/routes] sendEmail.default resolved from", c);
      return mod.default;
    }
  }
  console.warn("[auth/routes] sendEmail util NOT found in any known path");
  return null;
}

async function getCookieOptions() {
  const candidates = [
    "../src/utils/cookieOptions.js",
    "../utils/cookieOptions.js",
    "../../utils/cookieOptions.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    if (mod.cookieOptions) return mod.cookieOptions;
    return mod; // plain object export
  }
  // sane default
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

async function getAuthenticate() {
  const candidates = [
    "../src/middleware/authenticate.js",
    "../middleware/authenticate.js",
    "../../middleware/authenticate.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    const fn = (mod && (mod.default || mod.authenticate)) || mod;
    if (typeof fn === "function") return fn;
  }
  // fallback passthrough
  return (_req, _res, next) => next();
}

/**
 * Optionally resolve centralized CORS config.
 * If not present, we safely no-op.
 */
async function getCors() {
  const candidates = [
    "../src/config/corsConfig.js",
    "../config/corsConfig.js",
    "../../src/config/corsConfig.js",
    "../../config/corsConfig.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    const maybe = mod.default || mod;
    if (typeof maybe === "function") return maybe;
  }
  return (_req, _res, next) => next();
}

async function getValidators() {
  const candidates = [
    "../src/middleware/validators/auth.js",
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
  return {
    validateRegister: (_req, _res, next) => next(),
    validateLogin: (_req, _res, next) => next(),
  };
}

async function getProfileValidator() {
  const candidates = [
    "../src/middleware/profileValidator.js",
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
  const candidates = [
    "../src/middleware/upload.js",
    "../middleware/upload.js",
    "../../middleware/upload.js",
  ];
  for (const c of candidates) {
    const mod = await tryLoad(c);
    const up = (mod && (mod.default || mod)) || mod;
    if (up) return up;
  }
  // stub
  return {
    fields: () => (_req, _res, next) => next(),
  };
}

/** Try to resolve an auth controller with typical names/paths */
async function getAuthController() {
  const candidates = [
    "../src/api/controllers/authController.js",
    "../../src/api/controllers/authController.js",
    "../api/controllers/authController.js",
    "../../api/controllers/authController.js",
    "../src/controllers/authController.js",
    "../controllers/authController.js",
    "../../controllers/authController.js",

    // fallbacks — some repos use userController for auth
    "../src/controllers/userController.js",
    "../controllers/userController.js",
    "../../controllers/userController.js",
    "../src/api/controllers/userController.js",
    "../../src/api/controllers/userController.js",
    "../api/controllers/userController.js",
    "../../api/controllers/userController.js",
  ];

  for (const c of candidates) {
    const mod = await tryLoad(c);
    if (!mod) continue;
    const ns = (mod && (mod.default || mod)) || mod;
    const hasAny = ["register", "login", "refresh", "logout", "me", "profile"].some(
      (k) => typeof ns[k] === "function"
    );
    if (hasAny) return ns;

    // legacy export names
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

const router = express.Router();

// middleware to parse JSON, URL-encoded bodies, and cookies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

/** Utility: respond 501 if handler missing instead of returning 404 */
function notImplemented(name) {
  return (_req, res) =>
    res.status(501).json({ error: `Handler '${name}' is not implemented` });
}

/** Utility: wrap async route handlers */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Resolve cookie options once (safe default if resolver fails) */
let cookieOptionsPromise = null;
function getCookieOptionsOnce() {
  if (!cookieOptionsPromise) {
    cookieOptionsPromise = getCookieOptions().catch(() => ({
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    }));
  }
  return cookieOptionsPromise;
}

/* =============================================================================
   SHARED TOKEN RESOLVERS (used by /refresh and /me) — define ONCE
============================================================================= */
function pickFirstDefined(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}
function tokenFromAuthHeader(req) {
  const h = req?.headers?.authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
function tokenFromCookies(req) {
  const c = req?.cookies || {};
  return (
    c.accessToken ||
    c.jwt ||
    c.token ||
    c.refreshToken ||
    null
  );
}
function tokenFromQuery(req) {
  const q = req?.query || {};
  const v = q.token || q.access_token || q.accessToken;
  return typeof v === "string" && v.length ? v : null;
}
function resolveToken(req) {
  return (
    tokenFromAuthHeader(req) ||
    tokenFromCookies(req) ||
    tokenFromQuery(req) ||
    null
  );
}

/* 1) Refresh Access Token */
router.options("/refresh", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/refresh",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
  asyncHandler(async (req, res) => {
    // --- REPLACE START: robust refresh payload normalizer (aligns with authController.js) ---
    const bodyToken =
      (req.body && (req.body.refreshToken || req.body.token)) || null;
    const headerToken = tokenFromAuthHeader(req);
    const cookieToken =
      (req.cookies && (req.cookies.refreshToken || req.cookies.token)) || null;
    const token = (bodyToken || headerToken || cookieToken || "").trim();

    if (!token) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const secret =
      process.env.JWT_REFRESH_SECRET ||
      process.env.REFRESH_TOKEN_SECRET ||
      "test_refresh_secret";

    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      console.error("Refresh token error:", err?.message || err);
      return res
        .status(403)
        .json({ error: "Invalid or expired refresh token" });
    }

    const normalizedUserId =
      payload.userId ||
      payload.id ||
      payload.sub ||
      payload.uid ||
      payload._id ||
      "";

    if (!normalizedUserId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const accessSecret =
      process.env.JWT_SECRET ||
      process.env.ACCESS_TOKEN_SECRET ||
      "test_secret";

    const accessPayload = {
      sub: String(normalizedUserId),
      id: String(normalizedUserId),
      userId: String(normalizedUserId),
      uid: String(normalizedUserId),
      email: payload.email || "",
      role: payload.role || "user",
      isPremium: !!(payload.isPremium || payload.premium),
    };

    const accessToken = jwt.sign(accessPayload, accessSecret, {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        process.env.ACCESS_TOKEN_EXPIRES_IN ||
        "15m",
    });

    return res.json({
      accessToken,
      user: {
        id: String(normalizedUserId),
        userId: String(normalizedUserId),
        email: payload.email || "",
        role: payload.role || "user",
        isPremium: !!(payload.isPremium || payload.premium),
      },
    });
    // --- REPLACE END ---
  })
);

/* 2) Logout User */
router.options("/logout", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/logout",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
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

/* 3) Register New User */
router.options("/register", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/register",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
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

/* 4) Login User */
router.options("/login", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/login",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
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
// --- REPLACE START: add logging + sendEmail check + mail-logs ---
router.options("/forgot-password", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/forgot-password",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    const normalizedEmail = (email || "").trim().toLowerCase();
    console.log(
      "[auth/routes] /forgot-password hit for:",
      normalizedEmail || "<missing>"
    );
    writeMailLog(
      `[trace] /forgot-password called for ${normalizedEmail || "<missing>"}`
    );

    if (!normalizedEmail) {
      writeMailLog("[warn] /forgot-password missing email in body");
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const User = await getUserModel();
      if (!User) {
        writeMailLog("[error] User model unavailable in /forgot-password");
        return res.status(503).json({ error: "User model unavailable" });
      }

      const user = await User.findOne({ email: normalizedEmail });

      const generic = {
        message: "If an account exists, we'll email a link shortly.",
      };

      if (!user) {
        writeMailLog(
          `[info] /forgot-password: no user found for ${normalizedEmail}, returning generic`
        );
        return res.json(generic);
      }

      const resetToken = crypto.randomBytes(24).toString("hex");

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      await user.save();
      writeMailLog(
        `[info] /forgot-password: raw token generated and stored for ${normalizedEmail}`
      );

      const sendEmail = await getSendEmail();
      if (!sendEmail) {
        console.warn(
          "[auth/routes] sendEmail() not available, skipping real send"
        );
        writeMailLog(
          "[warn] sendEmail() not available, email NOT sent (check paths)"
        );
        return res.json(generic);
      }

      const base = process.env.CLIENT_URL || "http://localhost:5174";
      const resetURL = `${base}/reset-password?token=${resetToken}&id=${user._id}`;
      const message =
        "You requested a password reset. Click the link below to set a new password:\n\n" +
        resetURL +
        "\n\nIf you did not request this, ignore this email.";

      try {
        await sendEmail(user.email, "Password Reset Request", message);
        writeMailLog(
          `[ok] password reset email SENT to ${normalizedEmail} with url ${resetURL}`
        );
      } catch (mailErr) {
        console.error(
          "[auth/routes] sendEmail failed:",
          mailErr?.message || mailErr
        );
        writeMailLog(
          `[error] sendEmail failed for ${normalizedEmail}: ${
            mailErr?.message || mailErr
          }`
        );
      }

      return res.json(generic);
    } catch (err) {
      console.error("Forgot password error:", err?.message || err);
      writeMailLog(`[error] /forgot-password exception: ${err?.message || err}`);
      return res.status(500).json({ error: "Failed to process forgot password" });
    }
  })
);
// --- REPLACE END ---

/* 6) Reset Password */
// --- REPLACE START: tolerant reset that accepts RAW token OR SHA256(token) and newPassword OR password ---
router.options("/reset-password", async (req, res) => {
  const cors = await getCors();
  return cors(req, res, () => res.sendStatus(204));
});

router.post(
  "/reset-password",
  async (req, res, next) => {
    const cors = await getCors();
    return cors(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const id = (body.id || body.userId || "").trim();
    const tokenFromReq = (body.token || "").trim();
    const plainPassword = (body.newPassword || body.password || "").trim();

    console.log("[auth/routes] /reset-password body:", {
      id: id || "<none>",
      tokenLen: tokenFromReq.length,
    });

    if (!tokenFromReq || !plainPassword) {
      return res.status(400).json({ error: "Missing token or password." });
    }

    const User = await getUserModel();
    if (!User) {
      return res.status(503).json({ error: "User model unavailable" });
    }

    let user = null;

    if (id) {
      user = await User.findById(id);
      if (!user) {
        console.warn("[reset-password] user not found by id, will try by token…");
      } else if (user.passwordResetToken) {
        const asRaw = user.passwordResetToken === tokenFromReq;
        const asHashed =
          user.passwordResetToken ===
          crypto.createHash("sha256").update(tokenFromReq).digest("hex");
        if (!asRaw && !asHashed) {
          console.warn(
            "[reset-password] user found by id but token mismatch, will try token-based lookup…"
          );
          user = null;
        }
      }
    }

    if (!user) {
      user = await User.findOne({ passwordResetToken: tokenFromReq });
      if (user) {
        console.log("[reset-password] user found by RAW token:", String(user._id));
      }
    }

    if (!user) {
      const hashed = crypto.createHash("sha256").update(tokenFromReq).digest("hex");
      user = await User.findOne({ passwordResetToken: hashed });
      if (user) {
        console.log("[reset-password] user found by HASHED token:", String(user._id));
      }
    }

    if (!user) {
      console.warn("[reset-password] no user matched by id/token");
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    if (
      user.passwordResetExpires &&
      new Date(user.passwordResetExpires).getTime() < Date.now()
    ) {
      console.warn("[reset-password] token expired for user", String(user._id));
      return res
        .status(400)
        .json({ error: "Reset token has expired. Please request a new one." });
    }

    const hashedPass = await bcrypt.hash(plainPassword, 10);

    user.password = hashedPass;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordResetUsedAt = new Date();
    await user.save();

    try {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            passwordResetToken: "",
            passwordResetExpires: "",
            passwordResetUsedAt: "",
          },
        }
      );
    } catch (unsetErr) {
      console.warn(
        "[reset-password] extra $unset failed (non-fatal):",
        unsetErr?.message || unsetErr
      );
    }

    console.log("[reset-password] password changed for user", String(user._id));

    return res.json({ message: "Password has been reset successfully." });
  })
);
// --- REPLACE END ---

/* 7) Get Current User Profile (ROBUST) — unified with /api/me and /api/users/me */
// --- REPLACE START: unified /api/auth/me response shape ---
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const token = resolveToken(req);
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const secret = pickFirstDefined(
      process.env.JWT_SECRET,
      process.env.ACCESS_TOKEN_SECRET,
      "test_secret"
    );

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      console.error("[auth/me] jwt verify failed:", err?.message || err);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId =
      decoded.userId ||
      decoded.id ||
      decoded.sub ||
      decoded._id ||
      decoded.uid ||
      "";

    if (!userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const User = await getUserModel();
    if (!User) {
      const fallback = {
        id: userId,
        email: decoded.email || "",
        role: decoded.role || "user",
        isPremium: !!(decoded.isPremium || decoded.premium),
        premium: !!(decoded.isPremium || decoded.premium),
        entitlements: {
          tier: decoded.isPremium || decoded.premium ? "premium" : "free",
          since: null,
          until: null,
        },
      };
      return res.json(fallback);
    }

    const user = await User.findById(userId).select(
      "-password -passwordResetToken -passwordResetExpires"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const norm = normalizeUserOut(user);

    const isPremium = !!norm.isPremium;
    norm.isPremium = isPremium;
    norm.premium = isPremium;

    const ent =
      norm.entitlements && typeof norm.entitlements === "object"
        ? norm.entitlements
        : {};
    norm.entitlements = {
      tier: isPremium ? "premium" : "free",
      since: ent.since || null,
      until: ent.until || null,
      features: ent.features || undefined,
      quotas: ent.quotas || undefined,
    };

    if (!norm.stripeCustomerId && ent.stripeCustomerId) {
      norm.stripeCustomerId = ent.stripeCustomerId;
    }

    return res.json(norm);
  })
);
// --- REPLACE END ---

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

        const handler = async () => {
          try {
            const User = await getUserModel();
            if (!User) {
              return res
                .status(503)
                .json({ error: "User model unavailable" });
            }
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

            if (
              req.files &&
              req.files.image &&
              Array.isArray(req.files.image) &&
              req.files.image[0]
            ) {
              const f = req.files.image[0];
              updateData.profilePicture = `uploads/${f.filename}`;
            }

            if (
              req.files &&
              req.files.extraImages &&
              Array.isArray(req.files.extraImages)
            ) {
              updateData.extraImages = req.files.extraImages.map(
                (f) => `uploads/${f.filename}`
              );
            }

            const updated = await User.findByIdAndUpdate(id, updateData, {
              new: true,
            }).select("-password");
            return res.json(updated);
          } catch (err) {
            console.error("Profile update error:", err?.message || err);
            return res.status(500).json({ error: "Profile update failed" });
          }
        };

        if (typeof upload?.fields === "function") {
          return upload.fields([
            { name: "image", maxCount: 1 },
            { name: "extraImages", maxCount: 6 },
          ])(req, res, () => handler());
        }

        return handler();
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
        if (!User) {
          return res.status(503).json({ error: "User model unavailable" });
        }
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

// Final ESM export only (no CommonJS)
export default router;


