// PATH: server/routes/user.js

// --- REPLACE START: migrate file to ESM (imports instead of require) ---
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import pathFs from "path";
import fs from "fs";
import mongoose from "mongoose";
import { body, validationResult } from "express-validator";

// Interop for User model (ESM wrapper default-exporting the CJS model)
import * as UserModule from "../models/User.js";
const User = UserModule.default || UserModule;
// --- REPLACE END ---

const router = express.Router();

// --- REPLACE START: load ESM controller via direct import (Jest/CJS compatible) ---
import * as UserControllerModule from "../controllers/userController.js";
const {
  registerUser,
  loginUser,
  getMe, // (kept for other routes if your controller uses it elsewhere)
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  forgotPassword,
  resetPassword,
  // NEW: visibility handlers from controller
  setVisibilityMe,
  unhideMe,
} = UserControllerModule.default || UserControllerModule;

// Alias to requested route handler names (keep your wording)
// PATCH /users/me/hide  -> hideAccount
// PATCH /users/me/unhide -> unhideAccount
const hideAccount = setVisibilityMe;
const unhideAccount = unhideMe;
// --- REPLACE END ---

// --- REPLACE START: import notifications helper/model for superlike integration ---
import * as NotificationsControllerModule from "../controllers/notificationsController.js";
const { create: createNotificationHelper } =
  NotificationsControllerModule?.default || NotificationsControllerModule || {};
import * as NotificationModelModule from "../models/Notification.js";
const Notification = NotificationModelModule?.default || NotificationModelModule;
// --- REPLACE END ---

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
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
// --- REPLACE END ---

// --- REPLACE START: helper to normalize /users/me like /api/me ---
/**
 * Normalize user document to the exact shape used by /api/me.
 * Ensures isPremium, premium, and entitlements.tier are consistent.
 * Also exposes lightweight quota info for likes/superlikes.
 */
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
function countSuperLikes48h(u) {
  const ts = Array.isArray(u?.superLikeTimestamps) ? u.superLikeTimestamps : [];
  const since = Date.now() - 48 * 60 * 60 * 1000;
  return ts.reduce((n, t) => (new Date(t).getTime() >= since ? n + 1 : n), 0);
}

// --- REPLACE START: path normalizer for all image paths ---
function normPath(p) {
  if (typeof p !== "string" || !p) return p;
  let s = p.replace(/\\\\/g, "/").replace(/\\/g, "/");
  if (!s.startsWith("/")) s = `/${s}`; // ensure leading slash for web paths
  return s;
}
// --- REPLACE END ---

function normalizeUserForMe(u) {
  if (!u) return null;

  const ent = u.entitlements && typeof u.entitlements === "object" ? u.entitlements : {};
  const legacyFlag = !!u.premium;
  const newFlag = !!u.isPremium;
  const entTier = ent.tier === "premium";

  const isPremium = newFlag || legacyFlag || entTier;
  const tier = isPremium ? "premium" : "free";

  const visObj = u.visibility && typeof u.visibility === "object" ? u.visibility : {};
  const visibility = {
    isHidden: u.isHidden === true || visObj.isHidden === true || false,
    hiddenUntil: u.hiddenUntil || visObj.hiddenUntil || null,
    resumeOnLogin:
      typeof visObj.resumeOnLogin === "boolean"
        ? visObj.resumeOnLogin
        : (typeof u.resumeOnLogin === "boolean" ? u.resumeOnLogin : true),
  };

  // --- REPLACE START: normalize photo arrays & profilePicture slashes ---
  const rawPhotos =
    Array.isArray(u.photos) ? u.photos :
    (Array.isArray(u.extraImages) ? u.extraImages : []);
  const photos = rawPhotos.map(normPath);
  const profilePicture = normPath(u.profilePicture) || null;
  // --- REPLACE END ---

  // Quotas (likes reset daily for free users; superlikes rolling 48h)
  const usedLikesToday = countLikesToday(u);
  const usedSuperLikes48h = countSuperLikes48h(u);

  return {
    id: String(u._id || u.id),
    email: u.email || null,
    username: u.username || null,

    // consistent premium signals
    isPremium,
    premium: isPremium,

    entitlements: {
      tier,
      since: ent.since || null,
      until: ent.until || null,
      features: ent.features || undefined,
      quotas: {
        likesPerDay: {
          limit: isPremium ? null : FREE_LIKES_PER_DAY,
          used: usedLikesToday,
          remaining: isPremium ? null : Math.max(0, FREE_LIKES_PER_DAY - usedLikesToday),
        },
        superLikes: {
          window: "48h",
          used: usedSuperLikes48h,
          limit: isPremium ? 3 : 1,
          remaining: Math.max(0, (isPremium ? 3 : 1) - usedSuperLikes48h),
        },
      },
    },

    stripeCustomerId: u.stripeCustomerId || null,
    subscriptionId: u.subscriptionId || null,

    visibility,

    // --- REPLACE START: return normalized paths ---
    profilePicture,
    photos,
    // --- REPLACE END ---
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
// --- REPLACE END ---

// --- REPLACE START: outbound user normalizer for any generic user payload (photos/extraImages mirrored) ---
function toWebPath(p) {
  if (!p || typeof p !== "string") return p;
  let s = p.replace(/\\\\/g, "/").replace(/\\/g, "/");
  if (!s.startsWith("/")) s = `/${s}`;
  return s;
}
function normalizeUserOut(u) {
  if (!u) return u;
  const plain = typeof u.toObject === "function" ? u.toObject() : { ...u };

  const photosIn = Array.isArray(plain.photos) ? plain.photos : null;
  const extraIn  = Array.isArray(plain.extraImages) ? plain.extraImages : null;

  let canonical = photosIn || extraIn || [];
  if (photosIn && extraIn && extraIn.length > photosIn.length) canonical = extraIn;

  const normalizedList = (canonical || []).filter(Boolean).map(toWebPath);
  plain.photos = normalizedList;
  plain.extraImages = normalizedList;

  if (plain.profilePicture) plain.profilePicture = toWebPath(plain.profilePicture);
  if (plain.profilePhoto)   plain.profilePhoto   = toWebPath(plain.profilePhoto);

  return plain;
}
// --- REPLACE END ---

// 🎯 JSON-body parser
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

/* ============================================================================
   PUBLIC AUTH ROUTES
============================================================================ */

// --- REPLACE START: sanitize auth bodies so premium cannot be set accidentally ---
function stripPremiumFields(req, _res, next) {
  // Remove any premium-related fields from inbound auth requests
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

/* ============================================================================
   PROFILE & ACCOUNT
============================================================================ */

// =====================
/* ✅ Profile update with validation */
// =====================
router.put(
  "/profile",
  authenticateToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  [
    body("username").optional().notEmpty().withMessage("Username is required"),
    body("email").optional().isEmail().withMessage("Invalid email"),
    body("age").optional().isInt({ min: 18 }).withMessage("Age must be at least 18"),
    body("gender").optional().notEmpty().withMessage("Gender is required"),
    body("orientation").optional().notEmpty().withMessage("Orientation is required"),
    body("height").optional().isNumeric().withMessage("Height must be a number"),
    body("weight").optional().isNumeric().withMessage("Weight must be a number"),
    // --- REPLACE START: make lat/lon validators tolerant of empty strings ---
    body("latitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),
    // --- REPLACE END ---
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
        "Service",
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
    // --- REPLACE START: accept politicalIdeology input (trim/sanitize lightly) ---
    body("politicalIdeology").optional().trim().escape(),
    // Also accept legacy 'ideology' and sanitize it (we map it below)
    body("ideology").optional().trim().escape(),
    // --- REPLACE END ---
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

      // --- REPLACE START: normalize ideology keys BEFORE whitelist copy ---
      /**
       * Robust mapping between UI key `politicalIdeology` and any legacy `ideology`.
       * - If only `ideology` is present, copy it to `politicalIdeology`.
       * - We do NOT persist `ideology` directly to avoid strict schema issues.
       */
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
      // --- REPLACE END ---

      // --- REPLACE START: coerce or drop latitude/longitude when strings ---
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
      // --- REPLACE END ---

      // Fields to update
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
        // --- REPLACE START: added missing field for political ideology ---
        "politicalIdeology",
        // --- REPLACE END ---
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

      // --- REPLACE START: map top-level country/region/city into nested location before save ---
      if (
        req.body.country !== undefined ||
        req.body.region !== undefined ||
        req.body.city !== undefined
      ) {
        user.location = user.location || {};
        if (req.body.country !== undefined) user.location.country = req.body.country;
        if (req.body.region !== undefined) user.location.region = req.body.region;
        if (req.body.city !== undefined) user.location.city = req.body.city;
      }
      // --- REPLACE END ---

      // Profile picture
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // Extra images
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      const updated = await user.save();
      // --- REPLACE START: normalize image paths in response too ---
      const normalized = normalizeUserForMe(updated.toJSON ? updated.toJSON() : updated);
      return res.json(normalized);
      // --- REPLACE END ---
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed", details: err.message });
    }
  }
);

// --- REPLACE START: add GET /profile alias for current user (fix 500 on /api/users/profile)
// and normalize the payload identically to /api/me
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const doc = await User.findById(req.userId).exec();
    if (!doc) return res.status(404).json({ error: "User not found" });
    const u = doc.toJSON ? doc.toJSON() : doc;
    return res.json(normalizeUserForMe(u));
  } catch (err) {
    console.error("[/api/users/profile] error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: Current user via /me but NORMALIZED like /api/me ---
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const doc = await User.findById(req.userId).exec();
    if (!doc) return res.status(404).json({ error: "User not found" });
    const u = doc.toJSON ? doc.toJSON() : doc;
    return res.json(normalizeUserForMe(u));
  } catch (err) {
    console.error("[/api/users/me] error:", err?.message || err);
    return res.status(500).json({ error: "Unable to fetch current user" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: NEW visibility routes (hide / unhide my account) ---
/**
 * PATCH /users/me/hide
 * Body: { hidden: true, minutes?: number, resumeOnLogin?: boolean }
 * → Delegates to controller.hideAccount (alias of setVisibilityMe)
 */
router.patch("/me/hide", authenticateToken, hideAccount);

/**
 * PATCH /users/me/unhide
 * Body: (optional) {}
 * → Delegates to controller.unhideAccount (alias of unhideMe)
 */
router.patch("/me/unhide", authenticateToken, unhideAccount);
// --- REPLACE END ---

// 💎 Premium upgrade (alt path kept for compatibility)
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);
router.post("/premium", authenticateToken, upgradeToPremium);

// --- REPLACE START: likes quota helper endpoints (optional but useful for UI) ---
/**
 * GET /likes/quota
 * Returns today's like quota usage/remaining for the authenticated user.
 */
router.get("/likes/quota", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId).lean();
    if (!me) return res.status(404).json({ error: "User not found" });

    const isPremium = !!(me.isPremium || me.premium || me?.entitlements?.tier === "premium");
    const used = countLikesToday(me);
    return res.json({
      limit: isPremium ? null : FREE_LIKES_PER_DAY,
      used,
      remaining: isPremium ? null : Math.max(0, FREE_LIKES_PER_DAY - used),
      isPremium,
    });
  } catch (e) {
    return res.status(500).json({ error: "Unable to compute quota" });
  }
});
// --- REPLACE END ---

// 👀 Who liked me (premium-only)
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (!me.isPremium) return res.status(403).json({ error: "Premium only" });

    const likers = await User.find({ likes: req.userId }).select("username profilePicture");
    // --- REPLACE START: normalize profilePicture paths in list ---
    const out = (likers || []).map((doc) => {
      const u = doc.toObject ? doc.toObject() : { ...doc };
      return normalizeUserOut(u);
    });
    res.json(out);
    // --- REPLACE END ---
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// 📍 Nearby users (by coordinates)
router.get("/nearby", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const maxDistanceKm = 50;
    if (!user || user.latitude == null || user.longitude == null) {
      return res.status(400).json({ error: "User location is missing" });
    }

    const users = await User.find({
      _id: { $ne: req.userId },
      latitude: { $exists: true },
      longitude: { $exists: true },
    }).select("-password");

    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadius = 6371;

    const nearby = users.filter((u) => {
      const dLat = toRad((u.latitude || 0) - user.latitude);
      const dLon = toRad((u.longitude || 0) - user.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(user.latitude)) * Math.cos(toRad(u.latitude || 0)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const d = earthRadius * c;
      return d <= maxDistanceKm;
    });

    res.json(nearby);
  } catch (err) {
    console.error("Nearby error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================================
   SOCIAL GRAPH
============================================================================ */

// --- REPLACE START: like endpoint with FREE daily quota enforcement ---
/**
 * ❤️ Like (FREE users: 30/day; Premium unlimited)
 */
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

    const isPremium = !!(current.isPremium || current.premium || current?.entitlements?.tier === "premium");

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

// --- REPLACE START: superlike also creates a notification for the receiver ---
/**
 * 🌟 Superlike (with premium limits) + notification to the target user
 * Integration requirement: after a successful superlike, create a notification:
 * { toUser: targetId, fromUser: req.userId, type: 'superlike', message: 'You got a Superlike!' }
 * We DO NOT alter existing superlike limit logic; notification is best-effort.
 */
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
    const limit =
      current.isPremium || current.premium || current?.entitlements?.tier === "premium"
        ? 3
        : 1;

    if (current.superLikeTimestamps.length >= limit) {
      return res.status(403).json({
        error: "Superlike limit reached",
        window: "48h",
        limit,
        used: current.superLikeTimestamps.length,
        remaining: Math.max(0, limit - current.superLikeTimestamps.length),
      });
    }

    // Perform superlike record update
    if (!current.superLikes.includes(targetId)) {
      current.superLikes.push(targetId);
      current.superLikeTimestamps.push(now);
      await current.save();
    }

    // --- REPLACE START: Create Notification via controller helper (fallback to model) ---
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
      } else {
        // No notification plumbing available; silently skip to avoid breaking core flow
      }
    } catch (notifyErr) {
      // Non-fatal on purpose: do not block superlike if notifications fail
      console.warn("[superlike] notification creation failed:", notifyErr?.message || notifyErr);
    }
    // --- REPLACE END: Notification creation ---
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

// 🚫 Block user
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const blockId = req.params.id;
    if (!me) return res.status(404).json({ message: "User not found" });
    if (me._id.equals(blockId)) return res.status(400).json({ message: "Cannot block yourself" });
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================================================================
   MATCHES
============================================================================ */
router.get("/matches", authenticateToken, getMatchesWithScore);

/* ============================================================================
   PARAM VALIDATION (prevents /:id from matching non-ObjectId like "profile")
============================================================================ */
// --- REPLACE START: validate :id to avoid CastError/500 ---
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
});
// --- REPLACE END ---

/* ============================================================================
   IMAGES
============================================================================ */
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
      user.profilePicture = req.file.path;
      await user.save();

      // --- REPLACE START: normalize avatar response (paths + photos mirroring) ---
      const out = normalizeUserOut(user);
      return res.json(out);
      // --- REPLACE END ---
    } catch (err) {
      console.error("upload-avatar error:", err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

router.post("/:id/upload-photos", authenticateToken, upload.array("photos", 20), uploadExtraPhotos);
router.post("/:id/upload-photo-step", authenticateToken, upload.single("photo"), uploadPhotoStep);
router.delete("/:id/photos/:slot", authenticateToken, deletePhotoSlot);

/* ============================================================================
   LISTS & PUBLIC PROFILES
============================================================================ */

// --- REPLACE START: fix route order (static before /:id to avoid conflicts) ---
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const list = await User.find({ _id: { $ne: req.userId } }).select("username profilePicture extraImages photos");
    const out = (list || []).map((u) => normalizeUserOut(u));
    res.json(out);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
// --- REPLACE END ---

// ✅ Public profile by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    // --- REPLACE START: normalize outbound user ---
    return res.json(normalizeUserOut(user));
    // --- REPLACE END ---
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: ESM export default router ---
export default router;
// --- REPLACE END ---
