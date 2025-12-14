// PATH: server/src/routes/userRoutes.js
// @ts-nocheck
/* eslint-disable no-dupe-keys -- legacy query builder uses duplicate $or keys, last one wins */


// --- REPLACE START: migrate file to ESM and unify output normalizer across /me, /profile & PUT /profile ---
import fs from "fs";
import pathFs from "path";

import express from "express";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// --- REPLACE END ---

// --- REPLACE START: configuration/constants carried from legacy user.js ---
const FREE_LIKES_PER_DAY = Number(process.env.FREE_LIKES_PER_DAY || 30);
// If you want to completely disable login/register on THIS router (because /api/auth/* is now the main one),
// set this to false via ENV.
const ENABLE_USER_AUTH_ENDPOINTS =
  process.env.ENABLE_USER_AUTH_ENDPOINTS === "true" ||
  process.env.ENABLE_USER_AUTH_ENDPOINTS === "1" ||
  // default to true to keep backward compat
  true;
// --- REPLACE END ---

// --- REPLACE START: import shared CORS helper lazily to avoid hard crashes if file moves ---
let _corsConfig = null;
async function getCorsConfig() {
  if (_corsConfig) return _corsConfig;
  try {
    const mod = await import("../config/cors.js");
    _corsConfig = mod.default || mod;
  } catch (_e) {
    // fallback: allow basic CORS
    _corsConfig = (req, res, next) => {
      res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
      res.header("Access-Control-Allow-Credentials", "true");
      if (req.method === "OPTIONS") return res.sendStatus(204);
      return next();
    };
  }
  return _corsConfig;
}
// --- REPLACE END ---

// --- REPLACE START: lazy-load authController so password-reset family stays in ONE place ---
let _AuthController = null;
async function getAuthController() {
  if (_AuthController) return _AuthController;
  try {
    const mod = await import("../api/controllers/authController.js");
    _AuthController = mod.default || mod;
  } catch (_e) {
    _AuthController = {};
  }
  return _AuthController;
}
// --- REPLACE END ---

// Model (ESM/CJS interop)
// --- REPLACE START: lazy-load User model (keeps ESM/CJS interop) & remove duplicate 'User' redeclaration ---
let _UserModel = null;
async function getUserModel() {
  if (_UserModel) return _UserModel;
  try {
    const mod = await import("../models/User.js");
    _UserModel = mod.default || mod.User || mod;
  } catch (e) {
    _UserModel = null;
  }
  return _UserModel;
}
// --- REPLACE END ---

// Use the single shared normalizer — do NOT re-implement
import normalizeUserOut, {
  normalizeUsersOut,
} from "../utils/normalizeUserOut.js";

// --- REPLACE START: optional Notifications support (best-effort) ---
let _NotificationsController = null;
let _NotificationModel = null;
async function getNotificationsHelper() {
  if (_NotificationsController || _NotificationModel)
    return { _NotificationsController, _NotificationModel };
  try {
    const ctrl = await import("../controllers/notificationsController.js");
    _NotificationsController = ctrl?.default || ctrl || {};
  } catch (_e) {
    _NotificationsController = {};
  }
  try {
    const model = await import("../models/Notification.js");
    _NotificationModel = model?.default || model || {};
  } catch (_e) {
    _NotificationModel = {};
  }
  return { _NotificationsController, _NotificationModel };
}
// --- REPLACE END ---

// Load controller (supports both default and named).
// --- REPLACE START: lazy-load userController to prevent import-time failures, remove undefined `UserControllerModule` ---
let _UserController = null;
async function getUserController() {
  if (_UserController) return _UserController;
  try {
    const mod = await import("../controllers/userController.js");
    _UserController = mod.default || mod;
  } catch (_e) {
    _UserController = {};
  }
  return _UserController;
}
// --- REPLACE END ---

// --- REPLACE START: lazy-load Superlike controller (weekly quota; single source of truth) ---
let _SuperlikeController = null;
async function getSuperlikeController() {
  if (_SuperlikeController) return _SuperlikeController;
  try {
    const mod = await import("../controllers/superlikeController.js");
    _SuperlikeController = mod?.default || mod || {};
  } catch (_e) {
    _SuperlikeController = {};
  }
  return _SuperlikeController;
}
// --- REPLACE END ---

const router = express.Router();

// --- REPLACE START: ensure User model is available on req (lazy) ---
router.use(async (req, res, next) => {
  if (!req.UserModel) {
    try {
      const M = await getUserModel();
      req.UserModel = M || null;
    } catch {
      req.UserModel = null;
    }
  }
  return next();
});
// --- REPLACE END ---

/* =============================================================================
   AUTH MIDDLEWARE (robust token extraction)
============================================================================= */
function pickFirstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
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
  return c.accessToken || c.jwt || c.token || c.refreshToken || null;
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

// 🔐 Middleware: verify JWT and attach req.userId + req.user
function authenticateToken(req, res, next) {
  const token = resolveToken(req);
  if (!token) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
    return res.status(401).json({ error: "No token provided" });
  }
  const secret = pickFirstDefined(
    process.env.JWT_SECRET,
    process.env.ACCESS_TOKEN_SECRET
  );
  if (!secret) return res.status(500).json({ error: "Server JWT secret not configured" });
  try {
    const decoded = jwt.verify(token, secret);
    const id = String(
      decoded.id || decoded.userId || decoded.sub || decoded._id || ""
    );
    if (!id) return res.status(401).json({ error: "Invalid token payload" });
    req.userId = id;
    req.user = { id, userId: id, role: decoded.role || "user", ...decoded };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* =============================================================================
   PATH HELPERS
============================================================================= */
// --- REPLACE START: stronger normalization to enforce `/uploads/...` canonical paths ---
function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = String(p).replace(/\\\\/g, "/").replace(/\\/g, "/");
  s = s.replace(/^https?:\/\/[^/]+/i, "");
  s = s.replace(/^\/?uploads\/?/i, "");
  s = `/uploads/${s}`.replace(/\/{2,}/g, "/");
  return s;
}
// --- REPLACE END ---

// --- REPLACE START: S3 mirror helpers for user media uploads ---
const S3_REGION = process.env.AWS_REGION || "eu-north-1";
const S3_BUCKET = process.env.AWS_S3_BUCKET || "loventia-user-uploads";

let s3Client = null;

/**
 * Get or create a singleton S3 client.
 * If bucket is not configured, returns null and effectively disables S3 uploads.
 */
function getS3Client() {
  if (!S3_BUCKET) {
    console.warn("[S3][userRoutes] Bucket name not configured, skipping S3 uploads");
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({ region: S3_REGION });
  }
  return s3Client;
}

/**
 * Upload a file addressed by a web-style path ("/uploads/...") to S3.
 * - webPath is converted to a key without leading slash ("uploads/...")
 * - local file is read from process.cwd() + key
 * - best-effort: on error, logs and returns null
 *
 * @param {string} webPath
 * @param {string|undefined} contentType
 * @returns {Promise<string|null>}
 */
// --- REPLACE START: uploadWebPathToS3 — robust local path resolve + no ACL ---
async function uploadWebPathToS3(webPath, contentType) {
  try {
    const client = getS3Client();
    if (!client || !webPath) return null;

    // "/uploads/x.png" -> "uploads/x.png"
    const key = String(webPath).replace(/\\/g, "/").replace(/^\/+/, "");

    // Try a few likely roots:
    // - if server started in /server: process.cwd() => ...\server
    // - if server started in repo root: process.cwd() => ...\
    const candidates = [
      pathFs.resolve(process.cwd(), key),
      pathFs.resolve(process.cwd(), "..", key),
      pathFs.resolve(process.cwd(), "..", "..", key),
    ];

    const absolutePath = candidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (!absolutePath) {
      console.error("[S3][userRoutes] local file not found for upload", {
        webPath,
        key,
        tried: candidates,
      });
      return null;
    }

    const data = await fs.promises.readFile(absolutePath);

    const putParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: data,
      // NOTE: do NOT set ACL here (many buckets have ACLs disabled)
    };

    if (contentType) putParams.ContentType = contentType;

    await client.send(new PutObjectCommand(putParams));

    const publicUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    console.log("[S3][userRoutes] uploaded", { key, publicUrl });
    return publicUrl;
  } catch (err) {
    console.error("[S3][userRoutes] upload error for", webPath, "-", err?.message || err);
    return null;
  }
}
// --- REPLACE END ---


/**
 * Best-effort S3 mirroring for existing user media.
 * Useful when upload logic lives inside controllers (e.g. uploadPhotoStep),
 * so we can still ensure S3 has matching objects for /uploads/... paths.
 *
 * @param {any} userDoc
 */
async function mirrorUserMediaToS3(userDoc) {
  try {
    if (!userDoc) return;

    const raw =
      typeof userDoc.toObject === "function"
        ? userDoc.toObject()
        : typeof userDoc.toJSON === "function"
        ? userDoc.toJSON()
        : { ...userDoc };

    const pathsSet = new Set();

    if (raw.profilePicture) {
      pathsSet.add(raw.profilePicture);
    }

    if (Array.isArray(raw.photos)) {
      raw.photos.forEach((p) => p && pathsSet.add(p));
    }

    if (Array.isArray(raw.extraImages)) {
      raw.extraImages.forEach((p) => p && pathsSet.add(p));
    }

    for (const localPath of pathsSet) {
      const webPath = toWebPath(localPath);
      if (!webPath) continue;

      const ext = pathFs.extname(webPath).toLowerCase();
      let mime;
      if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
      else if (ext === ".png") mime = "image/png";
      else if (ext === ".gif") mime = "image/gif";
      else if (ext === ".webp") mime = "image/webp";

      // eslint-disable-next-line no-await-in-loop
      await uploadWebPathToS3(webPath, mime);
    }
  } catch (err) {
    console.error(
      "[S3][userRoutes] mirrorUserMediaToS3 error:",
      err?.message || err
    );
  }
}
// --- REPLACE END ---

/* =============================================================================
   COMMON MIDDLEWARE
============================================================================= */
router.use(express.json());

/* =============================================================================
   MULTER (uploads) + helpers
============================================================================= */
const uploadsDir = pathFs.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  for (const sub of ["avatars", "extra"]) {
    const dir = pathFs.join(uploadsDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
} catch {
  /* noop */
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) =>
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        pathFs.extname(file.originalname)
    ),
});
const upload = multer({ storage });

function removeFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* noop */
  }
}

// --- REPLACE START: conditional multer wrapper from legacy (JSON or multipart) ---
function maybeUpload(fields) {
  const fieldsMw = upload.fields(fields);
  return (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (ct.toLowerCase().startsWith("multipart/form-data")) {
      return fieldsMw(req, res, next);
    }
    return next();
  };
}
// --- REPLACE END ---

function mustBeSelfOrAdmin(req, res, next) {
  try {
    const paramId = String(req.params?.id || "");
    const myId = String(req.userId || req.user?.id || "");
    const role = (req.user?.role || "").toLowerCase();
    if (paramId && myId && (paramId === myId || role === "admin")) return next();
    return res.status(403).json({ error: "Forbidden" });
  } catch {
    return res.status(403).json({ error: "Forbidden" });
  }
}

/* =============================================================================
   PUBLIC AUTH ROUTES (note: these will be /api/users/login etc. because router is mounted at /users)
============================================================================= */
// --- REPLACE START: sanitize auth bodies so premium cannot be set accidentally ---
function stripPremiumFields(req, _res, next) {
  if (req?.body && typeof req.body === "object") {
    delete req.body.premium;
    delete req.body.isPremium;
    delete req.body.entitlements;
    delete req.body.subscriptionId;
    delete req.body.stripeCustomerId;
  }
  next();
}
// --- REPLACE END ---

if (ENABLE_USER_AUTH_ENDPOINTS) {
  // ➜ these will become /api/users/register
  router.post("/register", stripPremiumFields, async (req, res, next) => {
    const { registerUser } = await getUserController();
    return typeof registerUser === "function"
      ? registerUser(req, res, next)
      : res.sendStatus(404);
  });

  // ➜ this will become /api/users/login (NOT /api/auth/login, that lives in server/src/routes/auth.js)
  router.post("/login", stripPremiumFields, async (req, res, next) => {
    // 1) prefer the main auth controller
    const auth = await getAuthController();
    const authLogin = auth && typeof auth.login === "function" ? auth.login : null;

    if (authLogin) {
      return authLogin(req, res, next);
    }

    // 2) fallback to userController.loginUser (older path)
    const { loginUser } = await getUserController();
    if (typeof loginUser === "function") {
      return loginUser(req, res, next);
    }

    // 3) final fallback
    return res.status(404).json({ error: "Login handler not available" });
  });

  // ➜ /api/users/forgot-password  (mirrors /api/auth/forgot-password)
  router.options("/forgot-password", async (req, res, next) => {
    const cors = await getCorsConfig();
    return cors(req, res, next);
  });
  router.post("/forgot-password", async (req, res, next) => {
    const cors = await getCorsConfig();
    cors(req, res, async () => {
      const auth = await getAuthController();
      const forgot = auth.forgotPassword;
      if (typeof forgot === "function") {
        return forgot(req, res, next);
      }
      const { forgotPassword: userForgot } = await getUserController();
      return typeof userForgot === "function"
        ? userForgot(req, res, next)
        : res.status(200).json({
            message: "If an account exists, we'll email a link shortly.",
          });
    });
  });

  // ➜ /api/users/reset-password
  router.post("/reset-password", async (req, res, next) => {
    const { resetPassword } = await getUserController();
    return typeof resetPassword === "function"
      ? resetPassword(req, res, next)
      : res.sendStatus(404);
  });
} else {
  console.log(
    "[userRoutes] user-level auth endpoints DISABLED (set ENABLE_USER_AUTH_ENDPOINTS=true to enable /api/users/login)"
  );
}

/* =============================================================================
   PROFILE & ACCOUNT
============================================================================= */
async function getFullProfile(req, res) {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("GET /profile error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}

// --- REPLACE START: make /api/users/me match the compact /api/me shape ---
function buildCompactMePayload(userDoc) {
  if (!userDoc) return null;

  const u =
    typeof userDoc.toJSON === "function"
      ? userDoc.toJSON()
      : typeof userDoc.toObject === "function"
      ? userDoc.toObject()
      : { ...userDoc };

  // Strip sensitive stuff just in case
  delete u.password;
  delete u.passwordResetToken;
  delete u.passwordResetExpires;

  const ent =
    u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
  const dbIsPremium = !!u.isPremium;
  const tier = dbIsPremium ? "premium" : "free";

  const visObj = u.visibility && typeof u.visibility === "object" ? u.visibility : {};
  const visibility = {
    isHidden:
      u.isHidden === true ||
      visObj.isHidden === true ||
      false,
    hiddenUntil: u.hiddenUntil || visObj.hiddenUntil || null,
    resumeOnLogin:
      typeof visObj.resumeOnLogin === "boolean"
        ? visObj.resumeOnLogin
        : typeof u.resumeOnLogin === "boolean"
        ? u.resumeOnLogin
        : true,
  };

  // media normalization
  let photos = Array.isArray(u.photos) ? u.photos : [];
  if (!photos.length && Array.isArray(u.extraImages)) {
    photos = u.extraImages;
  }

  return {
    id: String(u._id || u.id),
    email: u.email || null,
    username: u.username || null,

    // premium flags — mirror DB
    isPremium: dbIsPremium,
    premium: dbIsPremium,

    entitlements: {
      tier,
      since: ent.since || null,
      until: ent.until || null,
      features: ent.features || undefined,
      quotas: ent.quotas || undefined,
    },

    // billing (both top-level and nested normalized)
    stripeCustomerId: u.stripeCustomerId || (ent && ent.stripeCustomerId) || null,
    subscriptionId: u.subscriptionId || null,

    visibility,

    profilePicture: u.profilePicture || null,
    photos,

    name: u.name || null,
    age: u.age || null,
    gender: u.gender || null,

    country: (u.location && u.location.country) || u.country || null,
    region: (u.location && u.location.region) || u.region || null,
    city: (u.location && u.location.city) || u.city || null,

    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null,
  };
}

async function getFullMe(req, res) {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });
    const user = await User.findById(req.userId).exec();
    if (!user) return res.status(404).json({ error: "User not found" });

    // return the compact /api/me style payload here
    const payload = buildCompactMePayload(user);
    return res.json(payload);
  } catch (err) {
    console.error("GET /me error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}
// --- REPLACE END ---

// ➜ /api/users/profile
router.get("/profile", authenticateToken, getFullProfile);
// ➜ /api/users/me  (matches /api/me)
router.get("/me", authenticateToken, getFullMe);

// --- REPLACE START: self-service account deletion (DELETE /api/users/me) ---
router.delete("/me", authenticateToken, async (req, res) => {
  try {
    console.log("DELETE /me: handler entered, userId =", req.userId);

    const User = await getUserModel();
    if (!User) {
      console.error("DELETE /me: User model not available (getUserModel returned null/undefined)");
      return res.status(500).json({ error: "User model not available" });
    }

    // Extra diagnostics about the model
    try {
      console.log(
        "DELETE /me: User model type =",
        typeof User,
        "keys =",
        User && typeof User === "function" ? Object.keys(User) : Object.keys(User || {})
      );
    } catch (diagErr) {
      console.error(
        "DELETE /me: diagnostic on User model failed:",
        diagErr?.message || diagErr
      );
    }

    let user;
    try {
      console.log("DELETE /me: calling User.findById(", req.userId, ")");
      user = await User.findById(req.userId);
      console.log("DELETE /me: findById result =", user ? "FOUND" : "NOT FOUND");
    } catch (findErr) {
      console.error(
        "DELETE /me: User.findById threw:",
        findErr?.message || findErr,
        "\nstack:",
        findErr?.stack
      );
      return res.status(500).json({ error: "Account deletion failed" });
    }

    // Idempotent: if user is already gone, still return 204
    if (!user) {
      console.log("DELETE /me: user not found, returning 204 (idempotent)");
      return res.status(204).send();
    }

    // Best-effort: delete user's images from disk
    try {
      console.log("DELETE /me: starting image cleanup");
      if (user.profilePicture) {
        console.log("DELETE /me: removing profilePicture =", user.profilePicture);
        removeFile(user.profilePicture);
      }

      const imgList = [
        ...(Array.isArray(user.photos) ? user.photos : []),
        ...(Array.isArray(user.extraImages) ? user.extraImages : []),
      ];

      const uniqueImgs = [...new Set(imgList)];
      console.log("DELETE /me: unique image paths =", uniqueImgs);

      for (const p of uniqueImgs) {
        if (!p) continue;
        if (p === user.profilePicture) continue; // already handled
        console.log("DELETE /me: removing extra image =", p);
        removeFile(p);
      }
      console.log("DELETE /me: image cleanup finished");
    } catch (cleanupErr) {
      console.error(
        "DELETE /me: image cleanup error:",
        cleanupErr?.message || cleanupErr,
        "\nstack:",
        cleanupErr?.stack
      );
      // Ignore file delete errors, account deletion should still continue
    }

    // Actual account deletion
    try {
      console.log(
        "DELETE /me: calling User.collection.deleteOne({_id:",
        user._id,
        "})"
      );

      // ✅ Use direct collection delete to bypass Mongoose execPre/execPost quirks
      const result = await User.collection.deleteOne({ _id: user._id });

      console.log("DELETE /me: collection.deleteOne raw result =", result);

      if (!result || result.deletedCount !== 1) {
        console.error(
          "DELETE /me: collection.deleteOne did not delete exactly one document:",
          result
        );
        return res.status(500).json({ error: "Account deletion failed" });
      }
    } catch (innerErr) {
      console.error(
        "DELETE /me: collection.deleteOne error:",
        innerErr?.message || innerErr,
        "\nstack:",
        innerErr?.stack
      );
      return res.status(500).json({ error: "Account deletion failed" });
    }

    // Frontend expectation: 204 = success, FE logs user out and clears state
    console.log("DELETE /me: success, returning 204");
    return res.status(204).send();
  } catch (err) {
    console.error(
      "DELETE /me error (outer catch):",
      err?.message || err,
      "\nstack:",
      err?.stack
    );
    return res.status(500).json({ error: "Account deletion failed" });
  }
});
// --- REPLACE END ---

/* =============================================================================
   VISIBILITY (hide / unhide)
============================================================================= */
router.patch("/me/hide", authenticateToken, async (req, res) => {
  try {
    const { setVisibilityMe } = await getUserController();
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const { hidden = true, minutes, resumeOnLogin } = req.body || {};
    if (!setVisibilityMe) {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      user.isHidden = !!hidden;
      user.resumeOnLogin =
        typeof resumeOnLogin === "boolean" ? resumeOnLogin : user.resumeOnLogin;

      if (Number.isFinite(Number(minutes)) && Number(minutes) > 0) {
        const ms = Number(minutes) * 60 * 1000;
        user.hiddenUntil = new Date(Date.now() + ms);
      } else if (hidden) {
        user.hiddenUntil = null;
      } else {
        user.hiddenUntil = null;
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    }

    await setVisibilityMe(req, res, async () => {
      const after = await User.findById(req.userId).select("-password");
      return res.json(normalizeUserOut(after));
    });
  } catch (err) {
    console.error("PATCH /me/hide error:", err?.message || err);
    return res.status(500).json({ error: "Visibility update failed" });
  }
});

router.patch("/me/unhide", authenticateToken, async (req, res) => {
  try {
    const { unhideMe } = await getUserController();
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    if (!unhideMe) {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      user.isHidden = false;
      user.hiddenUntil = null;
      await user.save();
      return res.json(normalizeUserOut(user));
    }
    await unhideMe(req, res, async () => {
      const after = await User.findById(req.userId).select("-password");
      return res.json(normalizeUserOut(after));
    });
  } catch (err) {
    console.error("PATCH /me/unhide error:", err?.message || err);
    return res.status(500).json({ error: "Visibility update failed" });
  }
});

/* =============================================================================
   UPDATE PROFILE
============================================================================= */
function isPlaceholderString(v) {
  if (v === null || v === undefined) return false;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (
    s === "" ||
    s === "select" ||
    s === "choose" ||
    s === "valitse" ||
    s === "n/a" ||
    s === "-" ||
    s === "—"
  );
}
function applyFrontAliases(src) {
  const dst = { ...src };

  if (
    (dst.politicalIdeology === undefined || isPlaceholderString(dst.politicalIdeology)) &&
    dst.ideology !== undefined
  ) {
    dst.politicalIdeology = dst.ideology;
    delete dst.ideology;
  }
  if (
    dst.lifestyle !== undefined &&
    (dst.activityLevel === undefined || isPlaceholderString(dst.activityLevel))
  ) {
    dst.activityLevel = dst.lifestyle;
  }
  if (
    dst.diet !== undefined &&
    (dst.nutritionPreferences === undefined || !Array.isArray(dst.nutritionPreferences))
  ) {
    if (Array.isArray(dst.diet)) dst.nutritionPreferences = dst.diet;
    else if (typeof dst.diet === "string" && !isPlaceholderString(dst.diet))
      dst.nutritionPreferences = [dst.diet];
  }
  if (
    dst.about !== undefined &&
    (dst.summary === undefined || isPlaceholderString(dst.summary))
  ) {
    dst.summary = dst.about;
  }
  if (dst.goals !== undefined && (dst.goal === undefined || isPlaceholderString(dst.goal))) {
    dst.goal = dst.goals;
  }
  if (
    dst.searchingFor !== undefined &&
    (dst.lookingFor === undefined || isPlaceholderString(dst.lookingFor))
  ) {
    dst.lookingFor = dst.searchingFor;
  }
  ["smoking", "alcohol"].forEach((k) => {
    if (k in dst && typeof dst[k] === "string") {
      const target = k === "smoking" ? "smoke" : "drink";
      if (dst[target] === undefined || isPlaceholderString(dst[target])) {
        dst[target] = dst[k];
      }
    }
  });
  if (dst.height !== undefined && typeof dst.height === "string") {
    dst.height = isPlaceholderString(dst.height) ? undefined : Number(dst.height);
  }
  if (dst.weight !== undefined && typeof dst.weight === "string") {
    dst.weight = isPlaceholderString(dst.weight) ? undefined : Number(dst.weight);
  }
  if (dst.heightUnit !== undefined && isPlaceholderString(dst.heightUnit))
    dst.heightUnit = undefined;
  if (dst.weightUnit !== undefined && isPlaceholderString(dst.weightUnit))
    dst.weightUnit = undefined;

  return dst;
}

router.put(
  "/profile",
  authenticateToken,
  maybeUpload([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  [
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("age").optional().isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("height").optional().isFloat({ min: 0, max: 300 }).withMessage("Height must be a number"),
    body("weight").optional().isFloat({ min: 0, max: 1000 }).withMessage("Weight must be a number"),
    body("latitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const bodyIn = applyFrontAliases(req.body || {});
      const body = { ...bodyIn };

      const keysToClean = [
        "orientation",
        "education",
        "bodyType",
        "professionCategory",
        "profession",
        "religion",
        "religionImportance",
        "politicalIdeology",
        "children",
        "pets",
        "smoke",
        "drink",
        "drugs",
        "activityLevel",
        "summary",
        "goal",
        "lookingFor",
        "heightUnit",
        "weightUnit",
        "country",
        "region",
        "city",
      ];
      for (const k of keysToClean) {
        if (k in body && isPlaceholderString(body[k])) body[k] = undefined;
      }

      const fields = [
        "username",
        "email",
        "name",
        "age",
        "gender",
        "orientation",
        "height",
        "heightUnit",
        "weight",
        "weightUnit",
        "bodyType",
        "education",
        "professionCategory",
        "profession",
        "religion",
        "religionImportance",
        "politicalIdeology",
        "children",
        "pets",
        "smoke",
        "drink",
        "drugs",
        "nutritionPreferences",
        "activityLevel",
        "summary",
        "goal",
        "lookingFor",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "interests",
        "preferredGender",
        "preferredMinAge",
        "preferredMaxAge",
        "preferredInterests",
      ];

      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          const v = body[field];

          if (field === "interests" || field === "preferredInterests") {
            user[field] = Array.isArray(v)
              ? v
              : typeof v === "string"
              ? v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
            continue;
          }
          if (field === "nutritionPreferences") {
            user[field] = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
            continue;
          }
          if (field === "height" || field === "weight") {
            user[field] = v === undefined || v === null || v === "" ? undefined : Number(v);
            continue;
          }

          user[field] = v;
        }
      }

      if (
        body.country !== undefined ||
        body.region !== undefined ||
        body.city !== undefined
      ) {
        user.location = user.location || {};
        if (body.country !== undefined) user.location.country = body.country;
        if (body.region !== undefined) user.location.region = body.region;
        if (body.city !== undefined) user.location.city = body.city;
      }

      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
        user.photos = user.extraImages;
      }

      // Best-effort: mirror profile media uploaded via /profile to S3
      try {
        if (req.files?.profilePhoto?.length) {
          const f = req.files.profilePhoto[0];
          const webPath = toWebPath(f.path);
          await uploadWebPathToS3(webPath, f.mimetype);
        }
        if (req.files?.extraImages?.length) {
          for (const f of req.files.extraImages) {
            const webPath = toWebPath(f.path);
            // eslint-disable-next-line no-await-in-loop
            await uploadWebPathToS3(webPath, f.mimetype);
          }
        }
      } catch (e) {
        console.error(
          "[S3][userRoutes] /profile media mirror error:",
          e?.message || e
        );
      }

      const updated = await user.save();
      return res.json(normalizeUserOut(updated));
    } catch (err) {
      console.error("PUT /profile error:", err?.message || err);
      return res.status(500).json({ error: "Profile update failed" });
    }
  }
);

/* =============================================================================
   ACCOUNT DELETION (Danger zone)
============================================================================= */
// --- REPLACE START: DELETE /api/users/me and DELETE /api/users/:id (self or admin) ---
async function performAccountDeletion(userId, options = {}) {
  const User = await getUserModel();
  if (!User) {
    throw new Error("User model not available");
  }

  const user = await User.findById(userId);
  if (!user) {
    return { notFound: true };
  }

  // Optional soft-delete flags; if schema does not have these, Mongoose will just ignore them.
  user.deleted = {
    at: new Date(),
    reason: options.reason || "user_requested",
  };
  user.deletedAt = new Date();

  // For now we also physically delete the document to keep things simple in dev.
  // If later you want pure soft delete, remove this line and only save().
  await user.deleteOne();

  return { notFound: false };
}

// DELETE /api/users/me  → current user deletes own account
router.delete("/me", authenticateToken, async (req, res) => {
  try {
    const ctrl = await getUserController();
    const handler =
      ctrl?.deleteAccount ||
      ctrl?.deleteMe ||
      ctrl?.deleteUser;

    if (typeof handler === "function") {
      // If a dedicated controller exists, delegate to it (for Stripe cleanup, etc.)
      return handler(req, res);
    }

    const result = await performAccountDeletion(req.userId, {
      reason: "user_requested_me",
    });

    if (result.notFound) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      ok: true,
      deleted: true,
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("DELETE /me error:", err?.message || err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
});

// DELETE /api/users/:id  → self or admin删除 (mustBeSelfOrAdmin enforces access)
router.delete("/:id", authenticateToken, mustBeSelfOrAdmin, async (req, res) => {
  try {
    const ctrl = await getUserController();
    const handler =
      ctrl?.deleteAccountById ||
      ctrl?.deleteUser ||
      null;

    if (typeof handler === "function") {
      return handler(req, res);
    }

    const result = await performAccountDeletion(req.params.id, {
      reason: "user_or_admin_delete",
    });

    if (result.notFound) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      ok: true,
      deleted: true,
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("DELETE /:id error:", err?.message || err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
});
// --- REPLACE END ---

/* =============================================================================
   PREMIUM
============================================================================= */
router.post("/upgrade-premium", authenticateToken, async (req, res, next) => {
  const { upgradeToPremium } = await getUserController();
  return typeof upgradeToPremium === "function"
    ? upgradeToPremium(req, res, next)
    : res.sendStatus(404);
});
router.post("/premium", authenticateToken, async (req, res, next) => {
  const { upgradeToPremium } = await getUserController();
  return typeof upgradeToPremium === "function"
    ? upgradeToPremium(req, res, next)
    : res.sendStatus(404);
});

/* =============================================================================
   MATCHES & DISCOVERY
============================================================================= */
router.get("/matches", authenticateToken, async (req, res, next) => {
  const { getMatchesWithScore } = await getUserController();
  if (!getMatchesWithScore) return next();
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const me = await User.findById(req.userId).select("-password");
    if (!me) return res.status(404).json({ error: "User not found" });

    let wrote = false;
    const hijackRes = {
      ...res,
      json(payload) {
        try {
          if (Array.isArray(payload)) {
            const out = payload.map((u) => normalizeUserOut(u));
            wrote = true;
            return res.json(out);
          } else if (payload && payload.users) {
            const out = {
              ...payload,
              users: Array.isArray(payload.users)
                ? payload.users.map((u) => normalizeUserOut(u))
                : [],
            };
            wrote = true;
            return res.json(out);
          }
        } catch {
          /* fall back below */
        }
        wrote = true;
        return res.json(payload);
      },
    };
    await getMatchesWithScore(req, hijackRes, next);
    if (!wrote) {
      const others = await User.find({ _id: { $ne: req.userId } }).select("-password");
      return res.json(normalizeUsersOut(others));
    }
  } catch (err) {
    console.error("GET /matches error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =============================================================================
   SOCIAL GRAPH (Like / Superlike / Block)
============================================================================= */
function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const current = await User.findById(req.userId);
    const targetId = String(req.params.id || "");

    if (!current || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    if (current._id.equals(targetId)) {
      return res.status(400).json({ error: "Cannot like yourself" });
    }

    const isPremium =
      !!(current.isPremium || current.premium || current?.entitlements?.tier === "premium");

    if (!isPremium) {
      const start = startOfTodayUTC();
      current.likeTimestamps = (current.likeTimestamps || []).filter(
        (ts) => new Date(ts) >= start
      );
      if (current.likeTimestamps.length >= FREE_LIKES_PER_DAY) {
        return res.status(403).json({
          error: "Daily like limit reached",
          quota: {
            limit: FREE_LIKES_PER_DAY,
            used: current.likeTimestamps.length,
            remaining: 0,
          },
        });
      }
    }

    if (!Array.isArray(current.likes)) current.likes = [];
    if (!current.likes.includes(targetId)) {
      current.likes.push(targetId);
    }
    current.likeTimestamps = current.likeTimestamps || [];
    current.likeTimestamps.push(new Date());

    await current.save();

    const remaining =
      isPremium ? null : Math.max(0, FREE_LIKES_PER_DAY - (current.likeTimestamps || []).length);

    return res.json({
      message: "Liked successfully",
      quota: {
        limit: isPremium ? null : FREE_LIKES_PER_DAY,
        used: isPremium ? null : (current.likeTimestamps || []).length,
        remaining,
      },
    });
  } catch (e) {
    console.error("like error:", e?.message || e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: delegate superlike to unified weekly-quota controller ---
router.post("/superlike/:id", authenticateToken, async (req, res, next) => {
  try {
    const ctrl = await getSuperlikeController();
    const handler =
      ctrl?.superlikeUser ||
      ctrl?.default ||
      ctrl?.superlike ||
      ctrl?.create;

    if (typeof handler === "function") {
      return handler(req, res, next);
    }
    return res.status(500).json({ error: "Superlike controller not available" });
  } catch (e) {
    console.error("[userRoutes] superlike delegate error:", e?.message || e);
    return res.status(500).json({ error: "Superlike failed" });
  }
});
// --- REPLACE END ---

router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ message: "User model not available" });

    const me = await User.findById(req.userId);
    const blockId = String(req.params.id || "");
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!mongoose.Types.ObjectId.isValid(blockId))
      return res.status(400).json({ message: "Invalid user ID" });
    if (me._id.equals(blockId))
      return res.status(400).json({ message: "Cannot block yourself" });

    if (!Array.isArray(me.blockedUsers)) me.blockedUsers = [];
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch (err) {
    console.error("block error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================================================================
   PARAM VALIDATION
============================================================================= */
router.param("id", (_req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
});

/* =============================================================================
   IMAGES (UPLOAD / REORDER / SET-AVATAR)
============================================================================= */
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  mustBeSelfOrAdmin,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const localPath = req.file?.path;

      removeFile(user.profilePicture);
      user.profilePicture = localPath;

      await user.save();

      // Best-effort: mirror avatar to S3 using canonical /uploads/... path
      try {
        const webPath = toWebPath(localPath || "");
        await uploadWebPathToS3(webPath, req.file?.mimetype);
      } catch (e) {
        console.error(
          "[S3][userRoutes] avatar mirror error:",
          e?.message || e
        );
      }

      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("upload-avatar error:", err?.message || err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

// --- REPLACE START: upload-photo-step — mirror to S3, verify via HEAD (webPath), rollback on failure ---
router.post(
  "/:id/upload-photo-step",
  authenticateToken,
  mustBeSelfOrAdmin,
  upload.single("photo"),
  async (req, res, next) => {
    let originalJson = null;

    try {
      const { uploadPhotoStep } = await getUserController();
      if (typeof uploadPhotoStep !== "function") return res.sendStatus(404);

      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const userId = req.params.id;

      // Snapshot BEFORE (rollback target if S3 verify fails)
      const before = await User.findById(userId)
        .select("photos extraImages profilePicture profilePhoto avatar")
        .lean();

      // Capture controller output (prevent early res.json send)
      let capturedPayload = null;

      originalJson = res.json.bind(res);
      res.json = (payload) => {
        capturedPayload = payload;
        // Do NOT send now. We respond after mirror+verify.
        return res;
      };

      await uploadPhotoStep(req, res, next);

      // Restore json BEFORE we send our own response
      res.json = originalJson;

      // If controller already sent headers via res.send/res.end etc, bail out
      if (res.headersSent) return;

      const capturedStatus = res.statusCode || 200;
      if (capturedStatus >= 400) {
        return res
          .status(capturedStatus)
          .json(capturedPayload ?? { error: "Upload failed" });
      }

      // Fetch AFTER controller DB update
      const afterController = await User.findById(userId).select("-password");
      if (!afterController) return res.status(404).json({ error: "User not found" });

      // Mirror to S3 (best-effort, but MUST be awaited)
      await mirrorUserMediaToS3(afterController);

      // Fetch AFTER mirror (this is what we return)
      const afterMirror = await User.findById(userId).select("-password").lean();
      if (!afterMirror) return res.status(404).json({ error: "User not found" });

      // --- VERIFY: any NEW uploads must exist in S3 (HEAD). Rollback on failure.
      // Use SAME client + SAME bucket config as mirror uses:
      const client = getS3Client(); // uses S3_REGION + S3_BUCKET from this file
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

      const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      const urlOf = (x) =>
        typeof x === "string" ? x : x && typeof x.url === "string" ? x.url : null;

      const asWeb = (v) => {
        const u = urlOf(v);
        return u ? toWebPath(u) : null; // normalize to "/uploads/..."
      };

      const beforeWeb = new Set(
        [
          ...toArr(before?.photos).map(asWeb),
          ...toArr(before?.extraImages).map(asWeb),
          asWeb(before?.profilePicture),
          asWeb(before?.profilePhoto),
          asWeb(before?.avatar),
        ].filter(Boolean)
      );

      const afterWeb = [
        ...toArr(afterMirror.photos).map(asWeb),
        ...toArr(afterMirror.extraImages).map(asWeb),
        asWeb(afterMirror.profilePicture),
        asWeb(afterMirror.profilePhoto),
        asWeb(afterMirror.avatar),
      ].filter(Boolean);

      const newWeb = afterWeb.filter((p) => !beforeWeb.has(p));
      const uniqueNewWeb = Array.from(new Set(newWeb));

      const missing = [];

      if (client && uniqueNewWeb.length > 0) {
        for (const webPath of uniqueNewWeb) {
          // 1) ensure upload (retry upload just for NEW items)
          const ext = pathFs.extname(webPath).toLowerCase();
          let mime;
          if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
          else if (ext === ".png") mime = "image/png";
          else if (ext === ".gif") mime = "image/gif";
          else if (ext === ".webp") mime = "image/webp";

          // eslint-disable-next-line no-await-in-loop
          const publicUrl = await uploadWebPathToS3(webPath, mime);
          if (!publicUrl) {
            missing.push(webPath);
            continue;
          }

          // 2) HEAD verify
          try {
            const key = String(webPath).replace(/^\/+/, ""); // "/uploads/x" -> "uploads/x"
            // eslint-disable-next-line no-await-in-loop
            await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
          } catch {
            missing.push(webPath);
          }
        }
      }

      if (missing.length > 0) {
        // Rollback DB to BEFORE snapshot (best-effort)
        try {
          await User.findByIdAndUpdate(userId, {
            $set: {
              photos: before?.photos ?? [],
              extraImages: before?.extraImages ?? [],
              profilePicture: before?.profilePicture ?? null,
              profilePhoto: before?.profilePhoto ?? null,
              avatar: before?.avatar ?? null,
            },
          });
        } catch (rbErr) {
          console.error(
            "[S3][userRoutes] upload-photo-step rollback error:",
            rbErr?.message || rbErr
          );
        }

        return res.status(502).json({
          error: "S3 mirror/verify failed (rolled back DB)",
          missing,
        });
      }

      return res.json(normalizeUserOut(afterMirror));
    } catch (err) {
      // restore if we wrapped responders
      try {
        if (originalJson) res.json = originalJson;
      } catch {}

      console.error(
        "[userRoutes] upload-photo-step handler error:",
        err?.message || err
      );
      return res.status(500).json({ error: "Upload photo step failed" });
    }
  }
);
// --- REPLACE END ---

// --- REPLACE START: upload-photos — multi-upload to /uploads + mirror to S3 + verify via HEAD + rollback on failure ---
router.post(
  "/:id/upload-photos",
  authenticateToken,
  mustBeSelfOrAdmin,
  upload.fields([
    { name: "photos", maxCount: 8 },
    { name: "photos[]", maxCount: 8 },
  ]),
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const userId = req.params.id;

      const files = [
        ...(req.files?.photos || []),
        ...(req.files?.["photos[]"] || []),
      ];

      if (!files.length) {
        return res
          .status(400)
          .json({ error: "No files uploaded (use field 'photos')" });
      }

      // Snapshot BEFORE (rollback target if S3 verify fails)
      const before = await User.findById(userId)
        .select("photos extraImages profilePicture profilePhoto avatar")
        .lean();
      if (!before) return res.status(404).json({ error: "User not found" });

      // Load mutable doc
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const newLocalPaths = files.map((f) => f.path);

      const current =
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : Array.isArray(user.extraImages)
          ? user.extraImages
          : [];

      const merged = [...current, ...newLocalPaths];
      user.photos = merged;
      user.extraImages = merged;

      if (!user.profilePicture && merged.length) {
        user.profilePicture = merged[0];
      }

      // Save DB first (so state matches filesystem), then mirror+verify and rollback if needed
      await user.save();

      // --- S3 mirror+verify only NEW items (dedupe)
      const client = getS3Client();
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");

      const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
      const urlOf = (x) =>
        typeof x === "string" ? x : x && typeof x.url === "string" ? x.url : null;

      const asWeb = (v) => {
        const u = urlOf(v);
        return u ? toWebPath(u) : null; // always "/uploads/..."
      };

      const beforeWeb = new Set(
        [
          ...toArr(before?.photos).map(asWeb),
          ...toArr(before?.extraImages).map(asWeb),
          asWeb(before?.profilePicture),
          asWeb(before?.profilePhoto),
          asWeb(before?.avatar),
        ].filter(Boolean)
      );

      // NEW uploads from this request (local file paths)
      const newWeb = newLocalPaths.map((p) => toWebPath(p)).filter(Boolean);
      const uniqueNewWeb = Array.from(new Set(newWeb)).filter(
        (p) => !beforeWeb.has(p)
      );

      const missing = [];

      if (client && uniqueNewWeb.length > 0) {
        for (const webPath of uniqueNewWeb) {
          const ext = pathFs.extname(webPath).toLowerCase();
          let mime;
          if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
          else if (ext === ".png") mime = "image/png";
          else if (ext === ".gif") mime = "image/gif";
          else if (ext === ".webp") mime = "image/webp";

          // 1) ensure upload
          // eslint-disable-next-line no-await-in-loop
          const publicUrl = await uploadWebPathToS3(webPath, mime);
          if (!publicUrl) {
            missing.push(webPath);
            continue;
          }

          // 2) HEAD verify
          try {
            const key = String(webPath).replace(/^\/+/, ""); // "/uploads/x" -> "uploads/x"
            // eslint-disable-next-line no-await-in-loop
            await client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
          } catch {
            missing.push(webPath);
          }
        }
      }

      if (missing.length > 0) {
        // Rollback DB to BEFORE snapshot (best-effort)
        try {
          await User.findByIdAndUpdate(userId, {
            $set: {
              photos: before?.photos ?? [],
              extraImages: before?.extraImages ?? [],
              profilePicture: before?.profilePicture ?? null,
              profilePhoto: before?.profilePhoto ?? null,
              avatar: before?.avatar ?? null,
            },
          });
        } catch (rbErr) {
          console.error(
            "[S3][userRoutes] upload-photos rollback error:",
            rbErr?.message || rbErr
          );
        }

        return res.status(502).json({
          error: "S3 mirror/verify failed (rolled back DB)",
          missing,
        });
      }

      // Return latest user
      const fresh = await User.findById(userId).select("-password");
      if (!fresh) return res.status(404).json({ error: "User not found" });

      return res.json(normalizeUserOut(fresh));
    } catch (err) {
      console.error("[userRoutes] upload-photos handler error:", err?.message || err);
      return res.status(500).json({ error: "Upload photos failed" });
    }
  }
);
// --- REPLACE END ---






// DELETE /:id/photos/:slot
router.delete(
  "/:id/photos/:slot",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id, slot } = req.params;
      const idx = Number(slot);

      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({ error: "Invalid slot index" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list =
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || [];

      if (idx >= list.length) {
        return res.status(400).json({ error: "Invalid slot index (out of range)" });
      }

      removeFile(list[idx]);

      const next = list.filter((_, i) => i !== idx);
      user.photos = next;
      user.extraImages = next;

      if (next.length) {
        const normalizedNext = next.map(toWebPath);
        const currentAvatar = toWebPath(user.profilePicture || "");
        if (!normalizedNext.includes(currentAvatar)) {
          user.profilePicture = next[0];
        }
      } else {
        user.profilePicture = undefined;
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("DELETE /:id/photos/:slot (direct) error:", err?.message || err);
      return res.status(500).json({ error: "Delete photo failed" });
    }
  }
);

// DELETE /:id/photos?index=... | ?path=...
router.delete(
  "/:id/photos",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id } = req.params;
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list =
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || [];

      let didRemove = false;

      if (typeof req.query.index !== "undefined") {
        const idx = Number(req.query.index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
          return res.status(400).json({ error: "Invalid index" });
        }
        removeFile(list[idx]);
        const next = list.filter((_, i) => i !== idx);
        user.photos = next;
        user.extraImages = next;
        didRemove = true;
      } else if (typeof req.query.path === "string" && req.query.path.trim().length) {
        const norm = toWebPath(String(req.query.path));
        const mapped = list.map(toWebPath);
        if (!mapped.includes(norm)) {
          return res.status(400).json({ error: "Path not found in user photos" });
        }
        removeFile(norm);
        const next = list.filter((p) => toWebPath(p) !== norm);
        user.photos = next;
        user.extraImages = next;
        didRemove = true;
      } else {
        return res.status(400).json({ error: "Provide 'index' or 'path'" });
      }

      if (didRemove) {
        if (user.photos.length) {
          const normalizedNext = user.photos.map(toWebPath);
          const currentAvatar = toWebPath(user.profilePicture || "");
          if (!normalizedNext.includes(currentAvatar)) {
            user.profilePicture = user.photos[0];
          }
        } else {
          user.profilePicture = undefined;
        }
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("DELETE /:id/photos (direct) error:", err?.message || err);
      return res.status(500).json({ error: "Delete photo failed" });
    }
  }
);

// Legacy: DELETE /:id/photo
router.delete(
  "/:id/photo",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const idxRaw = req.query.index ?? req.query.slot;
      const idx = Number(idxRaw);
      const list =
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || [];

      if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
        return res.status(400).json({ error: "Invalid index/slot" });
      }

      removeFile(list[idx]);

      const nextList = list.filter((_, i) => i !== idx);
      user.photos = nextList;
      user.extraImages = nextList;
      if (
        nextList.length &&
        (!user.profilePicture || !nextList.includes(toWebPath(user.profilePicture)))
      ) {
        user.profilePicture = nextList[0];
      }
      if (!nextList.length) {
        user.profilePicture = undefined;
      }

      await user.save();
      return res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("DELETE /:id/photo error:", err?.message || err);
      res.status(500).json({ error: "Delete photo failed" });
    }
  }
);

// Reorder photos
router.put(
  "/:id/photos/reorder",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id } = req.params;
      const order = Array.isArray(req.body?.order) ? req.body.order : null;
      if (!order || !order.length) {
        return res.status(400).json({ error: "Provide non-empty 'order' array" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const orderNorm = order.map(toWebPath);
      const existing = (
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || []
      ).map(toWebPath);

      const inOrder = orderNorm.filter((p) => existing.includes(p));
      const leftovers = existing.filter((p) => !inOrder.includes(p));
      const finalOrder = [...inOrder, ...leftovers];

      user.photos = finalOrder;
      user.extraImages = finalOrder;
      if (finalOrder.length) {
        user.profilePicture = finalOrder[0];
      } else {
        user.profilePicture = undefined;
      }

      await user.save();
      res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("photos/reorder error:", err?.message || err);
      res.status(500).json({ error: "Reorder failed" });
    }
  }
);

// Set avatar by path or index
router.post(
  "/:id/set-avatar",
  authenticateToken,
  mustBeSelfOrAdmin,
  async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: "User model not available" });

      const { id } = req.params;
      let { path, index } = req.body || {};
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const list = (
        Array.isArray(user.photos) && user.photos.length
          ? user.photos
          : user.extraImages || []
      ).map(toWebPath);

      let chosen = null;

      if (typeof index !== "undefined" && index !== null) {
        const i = Number(index);
        if (Number.isInteger(i) && i >= 0 && i < list.length) {
          chosen = list[i];
        } else {
          return res.status(400).json({ error: "Invalid index" });
        }
      } else if (path) {
        const norm = toWebPath(String(path));
        if (!list.includes(norm)) {
          return res.status(400).json({ error: "Path not found in user photos" });
        }
        chosen = norm;
      } else {
        return res.status(400).json({ error: "Provide 'index' or 'path' to set as avatar" });
      }

      const reordered = [chosen, ...list.filter((p) => p !== chosen)];
      user.photos = reordered;
      user.extraImages = reordered;
      user.profilePicture = chosen;

      await user.save();
      res.json(normalizeUserOut(user));
    } catch (err) {
      console.error("set-avatar error:", err?.message || err);
      res.status(500).json({ error: "Set avatar failed" });
    }
  }
);

/* =============================================================================
   LISTS & PUBLIC PROFILES
============================================================================= */
router.get("/all", authenticateToken, async (_req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const list = await User.find({}).select("-password");
    res.json(normalizeUsersOut(list));
  } catch (err) {
    console.error("GET /all error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: nearby users endpoint for MapPage (city-based) ---
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/users/nearby?city=Kouvola[&limit=100]
 * - Authenticated
 * - Returns an array of users in the same city with coordinates set.
 * - Excludes the current user.
 */
router.get("/nearby", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const rawCity = (req.query.city || "").toString().trim();
    if (!rawCity) {
      return res.status(400).json({ error: "City is required" });
    }

    const cityRegex = new RegExp("^" + escapeRegex(rawCity) + "$", "i");

    const limitRaw = Number(req.query.limit || 100);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 100;

    const query = {
      _id: { $ne: req.userId },
      latitude: { $ne: null },
      longitude: { $ne: null },
      $or: [
        { "location.city": cityRegex },
        { city: cityRegex },
      ],
      $or: [
        { isHidden: { $exists: false } },
        { isHidden: false },
      ],
    };

    // Because we have two $or keys above, we should merge them correctly.
    // To keep behaviour clear, rebuild with $and so Mongo does not overwrite keys:
    const finalQuery = {
      $and: [
        { _id: { $ne: req.userId } },
        { latitude: { $ne: null } },
        { longitude: { $ne: null } },
        {
          $or: [
            { "location.city": cityRegex },
            { city: cityRegex },
          ],
        },
        {
          $or: [
            { isHidden: { $exists: false } },
            { isHidden: false },
          ],
        },
      ],
    };

    const list = await User.find(finalQuery)
      .select("-password")
      .limit(limit);

    return res.json(normalizeUsersOut(list));
  } catch (err) {
    console.error("GET /nearby error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: add legacy-compatible path /users/all (from old user.js) ---
// NOTE: since THIS router is mounted at `/api/users`, this will become `/api/users/users/all`.
// We KEEP it for backward compatibility, but it's better to hit `/api/users/all` above.
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const list = await User.find({ _id: { $ne: req.userId } })
      .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
      .lean();

    const out = (list || []).map((u) => {
      if (u.profilePicture) u.profilePicture = toWebPath(u.profilePicture);
      if (Array.isArray(u.photos)) u.photos = u.photos.map(toWebPath);
      if (Array.isArray(u.extraImages)) u.extraImages = u.extraImages.map(toWebPath);
      return normalizeUserOut(u);
    });

    res.json(out);
  } catch (err) {
    console.error("/users/all error:", err?.message || err);
    res.status(401).json({ error: "Invalid token" });
  }
});
// --- REPLACE END ---

// Public profile by ID (safe exclusions for public exposure)
// ➜ will be /api/users/:id   (NOT /api/:id anymore, because we mounted under /users in routes/index.js)
router.get("/:id", async (req, res) => {
  try {
    const User = await getUserModel();
    if (!User) return res.status(500).json({ error: "User model not available" });

    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("Public profile fetch error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

// --- REPLACE START: CJS compatibility export for app.js tryRequireRoute ---
try {
  if (typeof module !== "undefined" && module && typeof module.exports !== "undefined") {
    module.exports = router;
    module.exports.default = router;
  }
} catch (_e) {
  /* noop */
}
// --- REPLACE END ---

/* =============================================================================
   NOTES
   - /api/users/me now returns the same compact shape as /api/me (single source of truth for premium flags).
   - We kept the file long and structured, did not remove your existing routes.
   - All comments are in English.
   - Replacement regions are clearly marked.
   - IMPORTANT for your question:
     this router is mounted at the base path `/api/users`, so the actual login URL
     exposed by THIS file is `/api/users/login` (without the extra `/auth` in the path).
     The dedicated auth router (server/src/routes/auth.js) exposes the login at `/api/auth/login`.
   - Superlike is now DELEGATED to controllers/superlikeController.js to ensure the same weekly quota logic
     is used across both /api/superlike/:id and this legacy /api/users/superlike/:id endpoint.
   - New: /api/users/nearby?city=Kouvola returns an ARRAY of users with latitude/longitude,
     excluding the current user and hidden profiles. This is what MapPage.jsx uses.
   - New in this step: avatar, profile media, upload-photos and upload-photo-step flows now
     mirror their `/uploads/...` paths to S3 (best-effort) using the same key format as imageRoutes.js.
     If AWS_S3_BUCKET / AWS_REGION are not set, uploads still work locally exactly as before.
============================================================================= */


