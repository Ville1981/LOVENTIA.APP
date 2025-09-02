// PATH: server/routes/user.js

// --- REPLACE START: migrate file to ESM (imports instead of require) ---
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import pathFs from "path";
import fs from "fs";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";
// --- REPLACE END ---

const router = express.Router();

// --- REPLACE START: load ESM controller via direct import (Jest/CJS compatible) ---
import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;

import * as UserControllerModule from "../controllers/userController.js";
const {
  registerUser,
  loginUser,
  // getMe available in controller, but we inline the exact logic per requirements
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  forgotPassword,
  resetPassword,
  setVisibilityMe,
  unhideMe,
} = UserControllerModule.default || UserControllerModule;

import * as NotificationsControllerModule from "../controllers/notificationsController.js";
const { create: createNotificationHelper } =
  NotificationsControllerModule?.default || NotificationsControllerModule || {};

import * as NotificationModelModule from "../models/Notification.js";
const Notification = NotificationModelModule?.default || NotificationModelModule;

import normalizeUserOutUtil from "../utils/normalizeUserOut.js";
// --- REPLACE END ---

/* =============================================================================
   AUTH HELPERS
============================================================================= */

// --- REPLACE START: stronger auth (header/cookie/query + multiple secrets) ---
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
  return tokenFromAuthHeader(req) || tokenFromCookies(req) || tokenFromQuery(req) || null;
}

// 🔐 Middleware: ensure token validity, attach req.user AND req.userId
function authenticateToken(req, res, next) {
  const token = resolveToken(req);
  if (!token) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
    return res.status(401).json({ error: "No token provided" });
  }
  const secret = pickFirstDefined(process.env.JWT_SECRET, process.env.ACCESS_TOKEN_SECRET);
  if (!secret) return res.status(500).json({ error: "Server JWT secret not configured" });
  try {
    const decoded = jwt.verify(token, secret);
    const id = String(decoded.id || decoded.userId || decoded.sub || decoded._id || "");
    if (!id) return res.status(401).json({ error: "Invalid token payload" });
    req.userId = id; // backward compat for existing routes
    req.user = { id, userId: id, role: decoded.role || "user", ...decoded }; // compat with controller
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
// --- REPLACE END ---

/* =============================================================================
   UTILS
============================================================================= */

// --- REPLACE START: path normalizer for images ---
function toWebPath(p) {
  if (typeof p !== "string" || !p) return p;
  let s = p.replace(/\\\\/g, "/").replace(/\\/g, "/");
  if (!s.startsWith("/")) s = `/${s}`;
  return s;
}
// --- REPLACE END ---

// --- REPLACE START: quotas + time helpers ---
const FREE_LIKES_PER_DAY = Number(process.env.FREE_LIKES_PER_DAY || 30);

function startOfTodayUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function countLikesToday(u) {
  const ts = Array.isArray(u?.likeTimestamps) ? u.likeTimestamps : [];
  const start = startOfTodayUTC();
  return ts.reduce((n, t) => (new Date(t) >= start ? n + 1 : n), 0);
}
// --- REPLACE END ---

// --- REPLACE START: outbound user normalizer (delegate to shared util + path fixes) ---
function normalizeUserOut(u) {
  try {
    const obj = u && typeof u.toObject === "function" ? u.toObject() : { ...(u || {}) };

    if (obj && typeof obj === "object") {
      if (obj.profilePicture) obj.profilePicture = toWebPath(obj.profilePicture);
      if (Array.isArray(obj.photos)) obj.photos = obj.photos.map(toWebPath);
      if (Array.isArray(obj.extraImages)) obj.extraImages = obj.extraImages.map(toWebPath);
    }

    return normalizeUserOutUtil(obj);
  } catch {
    return u && (typeof u.toObject === "function" ? u.toObject() : { ...u });
  }
}
// --- REPLACE END ---

/* =============================================================================
   BODY / UPLOAD SETUP
============================================================================= */

// 🎯 JSON-body parser (keep first so JSON-only PUT works without forcing multipart)
router.use(express.json());

// --- REPLACE START: ensure uploads dir exists to avoid Multer ENOENT ---
const uploadsDir = pathFs.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch {
  /* noop */
}
// --- REPLACE END ---

// 🔧 Multer storage + file removal helper
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) =>
    cb(
      null,
      Date.now() + "-" + Math.round(Math.random() * 1e9) + pathFs.extname(file.originalname)
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

// --- REPLACE START: conditional multer wrapper so JSON is fully supported ---
/**
 * maybeUpload(fields)
 * - If Content-Type is multipart/form-data -> run the multer fields parser.
 * - Otherwise -> no-op (do not force multipart).
 */
function maybeUpload(fields) {
  const fieldsMw = upload.fields(fields);
  return (req, res, next) => {
    const ct = String(req.headers["content-type"] || "");
    if (ct.toLowerCase().startsWith("multipart/form-data")) {
      return fieldsMw(req, res, next);
    }
    // Not multipart → skip file parsing so JSON bodies work
    return next();
  };
}
// --- REPLACE END ---

/* =============================================================================
   AUTH PUBLIC ROUTES
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

router.post("/register", stripPremiumFields, registerUser);
router.post("/login", stripPremiumFields, loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* =============================================================================
   PROFILE & ACCOUNT
============================================================================= */

// =====================
// ✅ Profile update (JSON OR multipart), no forced multipart
// =====================
router.put(
  "/profile",
  authenticateToken,
  // --- REPLACE START: allow JSON or multipart ---
  maybeUpload([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  // --- REPLACE END ---
  [
    body("username").optional().notEmpty().withMessage("Username is required"),
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("age").optional().isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("gender").optional().notEmpty().withMessage("Gender is required"),
    body("orientation").optional().notEmpty().withMessage("Orientation is required"),
    body("height").optional().isNumeric().withMessage("Height must be a number"),
    body("weight").optional().isNumeric().withMessage("Weight must be a number"),
    // lat/lon tolerant of empty strings
    body("latitude").optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
    body("professionCategory")
      .optional({ checkFalsy: true })
      .isIn([
        "",
        "Administration",
        "Finance",
        "Military",
        "Technical",
        "Healthcare",
        "Education",
        "Entrepreneur",
        "Law",
        "Farmer/Forest worker",
        "Theologian/Priest",
        "Service",
        "Artist",
        "DivineServant",
        "Homeparent",
        "FoodIndustry",
        "Retail",
        "Arts",
        "Government",
        "Retired",
        "Athlete",
        "Other",
      ])
      .withMessage("Invalid profession category"),
    body("nutritionPreferences").optional().isArray().withMessage("Nutrition preferences must be an array"),
    // accept politicalIdeology and legacy ideology
    body("politicalIdeology").optional().trim().escape(),
    body("ideology").optional().trim().escape(),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Map legacy -> canonical key before updating
      if (
        (req.body.politicalIdeology === undefined ||
          req.body.politicalIdeology === null ||
          req.body.politicalIdeology === "") &&
        typeof req.body.ideology !== "undefined"
      ) {
        req.body.politicalIdeology = req.body.ideology;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "ideology")) {
        delete req.body.ideology;
      }

      // Coerce lat/lon from strings if needed
      const latRaw = req.body.latitude;
      const lonRaw = req.body.longitude;
      if (typeof latRaw === "string") {
        const s = latRaw.trim();
        if (s === "") delete req.body.latitude;
        else if (!Number.isNaN(parseFloat(s))) req.body.latitude = parseFloat(s);
        else delete req.body.latitude;
      }
      if (typeof lonRaw === "string") {
        const s = lonRaw.trim();
        if (s === "") delete req.body.longitude;
        else if (!Number.isNaN(parseFloat(s))) req.body.longitude = parseFloat(s);
        else delete req.body.longitude;
      }

      // Whitelisted mutable fields
      const fields = [
        "username",
        "email",
        "age",
        "gender",
        "orientation",
        "education",
        "height",
        "weight",
        "status",
        "religion",
        "religionImportance",
        "children",
        "pets",
        "summary",
        "goal",
        "lookingFor",
        "profession",
        "professionCategory",
        "heightUnit",
        "country",
        "region",
        "city",
        "latitude",
        "longitude",
        "smoke",
        "drink",
        "drugs",
        "bodyType",
        "activityLevel",
        "nutritionPreferences",
        "healthInfo",
        "interests",
        "preferredGender",
        "preferredMinAge",
        "preferredMaxAge",
        "preferredInterests",
        "preferredCountry",
        "preferredReligion",
        "preferredReligionImportance",
        "preferredEducation",
        "preferredProfession",
        "preferredChildren",
        "politicalIdeology",
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (["interests", "preferredInterests"].includes(field)) {
            user[field] = Array.isArray(req.body[field])
              ? req.body[field]
              : typeof req.body[field] === "string"
              ? req.body[field].split(",").map((s) => s.trim())
              : [];
          } else if (field === "nutritionPreferences") {
            if (Array.isArray(req.body[field])) user[field] = req.body[field];
            else if (typeof req.body[field] === "string") user[field] = [req.body[field]];
            else user[field] = [];
          } else {
            user[field] = req.body[field];
          }
        }
      });

      // Keep nested location in sync (UI may send top-level fields)
      if (req.body.country !== undefined || req.body.region !== undefined || req.body.city !== undefined) {
        user.location = user.location || {};
        if (req.body.country !== undefined) user.location.country = req.body.country;
        if (req.body.region !== undefined) user.location.region = req.body.region;
        if (req.body.city !== undefined) user.location.city = req.body.city;
      }

      // Handle files (only in multipart)
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      await user.save();

      // Return FULL profile (exclude only sensitive fields), normalized
      const full = await User.findById(user._id)
        .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
        .lean();
      if (full?.profilePicture) full.profilePicture = toWebPath(full.profilePicture);
      if (Array.isArray(full?.photos)) full.photos = full.photos.map(toWebPath);
      if (Array.isArray(full?.extraImages)) full.extraImages = full.extraImages.map(toWebPath);

      return res.json(normalizeUserOut(full));
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed", details: err.message });
    }
  }
);

// --- REPLACE START: GET /profile returns FULL profile (no inclusive selects) ---
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const doc = await User.findById(req.userId)
      .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
      .lean();
    if (!doc) return res.status(404).json({ error: "User not found" });

    if (doc.profilePicture) doc.profilePicture = toWebPath(doc.profilePicture);
    if (Array.isArray(doc.photos)) doc.photos = doc.photos.map(toWebPath);
    if (Array.isArray(doc.extraImages)) doc.extraImages = doc.extraImages.map(toWebPath);

    return res.json(normalizeUserOut(doc));
  } catch (err) {
    console.error("[GET /users/profile] error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: GET /me returns FULL profile (no inclusive selects) ---
router.get("/me", authenticateToken, async (req, res) => {
  try {
    // Controller getMe-equivalent: findById + exclude password + normalizeUserOut(user)
    const doc = await User.findById(req.userId)
      .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
      .lean();
    if (!doc) return res.status(404).json({ error: "User not found" });

    if (doc.profilePicture) doc.profilePicture = toWebPath(doc.profilePicture);
    if (Array.isArray(doc.photos)) doc.photos = doc.photos.map(toWebPath);
    if (Array.isArray(doc.extraImages)) doc.extraImages = doc.extraImages.map(toWebPath);

    return res.json(normalizeUserOut(doc));
  } catch (err) {
    console.error("[GET /users/me] error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: NEW visibility routes (hide / unhide my account) ---
router.patch("/me/hide", authenticateToken, setVisibilityMe);
router.patch("/me/unhide", authenticateToken, unhideMe);
// --- REPLACE END ---

// 💎 Premium upgrade (alt path kept for compatibility)
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);
router.post("/premium", authenticateToken, upgradeToPremium);

/* =============================================================================
   LIKE / SUPERLIKE
============================================================================= */

// --- REPLACE START: ❤️ Like with FREE daily quota enforcement ---
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
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

    // Quota: FREE only
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

    // Record like + timestamp
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
// --- REPLACE END ---

// --- REPLACE START: 🌟 Superlike (premium limits) + best-effort notification ---
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const targetId = String(req.params.id || "");

    if (!current || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    if (current._id.equals(targetId)) {
      return res.status(400).json({ error: "Cannot superlike yourself" });
    }

    const now = new Date();
    current.superLikeTimestamps = (current.superLikeTimestamps || []).filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );

    const premium =
      current.isPremium || current.premium || current?.entitlements?.tier === "premium";
    const limit = premium ? 3 : 1;

    if (current.superLikeTimestamps.length >= limit) {
      return res.status(403).json({
        error: "Superlike limit reached",
        window: "48h",
        limit,
        used: current.superLikeTimestamps.length,
        remaining: Math.max(0, limit - current.superLikeTimestamps.length),
      });
    }

    if (!Array.isArray(current.superLikes)) current.superLikes = [];
    if (!current.superLikes.includes(targetId)) {
      current.superLikes.push(targetId);
      current.superLikeTimestamps.push(now);
      await current.save();
    }

    // Best-effort notification (non-blocking)
    try {
      const payload = {
        toUser: targetId,
        fromUser: req.userId,
        type: "superlike",
        message: "You got a Superlike!",
      };
      if (typeof createNotificationHelper === "function") {
        await createNotificationHelper(payload);
      } else if (Notification && typeof Notification.create === "function") {
        await Notification.create(payload);
      }
    } catch (notifyErr) {
      console.warn("[superlike] notification failed:", notifyErr?.message || notifyErr);
    }

    return res.json({
      message: "Superliked successfully",
      window: "48h",
      limit,
      used: current.superLikeTimestamps.length,
      remaining: Math.max(0, limit - current.superLikeTimestamps.length),
    });
  } catch (e) {
    console.error("superlike error:", e?.message || e);
    res.status(500).json({ error: "Server error" });
  }
});
// --- REPLACE END ---

/* =============================================================================
   BLOCK / MATCHES
============================================================================= */

// 🚫 Block user
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const blockId = String(req.params.id || "");
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!mongoose.Types.ObjectId.isValid(blockId))
      return res.status(400).json({ message: "Invalid user ID" });
    if (me._id.equals(blockId)) return res.status(400).json({ message: "Cannot block yourself" });

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

// Matches
router.get("/matches", authenticateToken, getMatchesWithScore);

/* =============================================================================
   PARAM VALIDATION (prevent non-ObjectId from hitting '/:id')
============================================================================= */
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
});

/* =============================================================================
   IMAGES
============================================================================= */
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (req.userId !== id) return res.status(403).json({ error: "Forbidden" });
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      removeFile(user.profilePicture);
      user.profilePicture = req.file?.path || user.profilePicture;
      await user.save();

      const out = await User.findById(id)
        .select("-password -resetToken -passwordResetToken -passwordResetExpires -__v")
        .lean();
      if (out) {
        if (out.profilePicture) out.profilePicture = toWebPath(out.profilePicture);
        if (Array.isArray(out.photos)) out.photos = out.photos.map(toWebPath);
        if (Array.isArray(out.extraImages)) out.extraImages = out.extraImages.map(toWebPath);
      }
      return res.json(normalizeUserOut(out));
    } catch (err) {
      console.error("upload-avatar error:", err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

router.post("/:id/upload-photos", authenticateToken, upload.array("photos", 20), uploadExtraPhotos);
router.post("/:id/upload-photo-step", authenticateToken, upload.single("photo"), uploadPhotoStep);
router.delete("/:id/photos/:slot", authenticateToken, deletePhotoSlot);

/* =============================================================================
   LISTS & PUBLIC PROFILES
============================================================================= */

// --- REPLACE START: list all (except me) with safe exclusions only; avoid inclusive selects ---
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
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
    console.error("/users/all error:", err);
    res.status(401).json({ error: "Invalid token" });
  }
});
// --- REPLACE END ---

// ✅ Public profile by ID (safe field exclusions only; no inclusive selects)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select(
        "-password -resetToken -passwordResetToken -passwordResetExpires -__v -email -likes -superLikes -blockedUsers"
      )
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.profilePicture) user.profilePicture = toWebPath(user.profilePicture);
    if (Array.isArray(user.photos)) user.photos = user.photos.map(toWebPath);
    if (Array.isArray(user.extraImages)) user.extraImages = user.extraImages.map(toWebPath);

    return res.json(normalizeUserOut(user));
  } catch (err) {
    console.error("public profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: ESM export default router ---
export default router;
// --- REPLACE END ---

/* =============================================================================
   NOTES
   - GET /me and GET /profile now return the FULL profile using:
     findById().select("-password ...") + normalizeUserOut(user), as requested.
   - normalizeUserForMe was intentionally removed from usage to avoid field limits.
   - Ensured there are NO inclusive selects like .select("username email ...")
     anywhere; only exclusive selects (minus sensitive fields) are used.
   - Replacement regions are marked between // --- REPLACE START and // --- REPLACE END.
============================================================================= */




