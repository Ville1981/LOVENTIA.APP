// server/routes/users.js

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
  getMe,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  forgotPassword,
  resetPassword,
} = UserControllerModule.default || UserControllerModule;
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
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

/* ============================================================================
   PROFILE & ACCOUNT
============================================================================ */

// --- REPLACE START: add GET /profile alias BEFORE :id to avoid shadowing ---
router.get("/profile", authenticateToken, getMe);
// --- REPLACE END ---

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
    body("latitude").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
    body("longitude").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
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
      res.json(updated);
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed", details: err.message });
    }
  }
);

// ✅ Current user profile
router.get("/me", authenticateToken, getMe);

// 💎 Premium upgrade (alt path kept for compatibility)
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);
router.post("/premium", authenticateToken, upgradeToPremium);

// 👀 Who liked me (premium-only)
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(404).json({ error: "User not found" });
    if (!me.isPremium) return res.status(403).json({ error: "Premium only" });
    const likers = await User.find({ likes: req.userId }).select("username profilePicture");
    res.json(likers);
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

// ❤️ Like
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
    if (!current || !target) return res.status(400).json({ error: "Invalid request" });
    if (!current.likes.includes(target)) {
      current.likes.push(target);
      await current.save();
    }
    res.json({ message: "Liked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// 🌟 Superlike (with premium limits)
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
    if (!current || !target) return res.status(400).json({ error: "Invalid request" });

    const now = new Date();
    current.superLikeTimestamps = (current.superLikeTimestamps || []).filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );
    const limit = current.isPremium ? 3 : 1;
    if (current.superLikeTimestamps.length >= limit) {
      return res.status(403).json({ error: "Superlike limit reached" });
    }
    if (!current.superLikes.includes(target)) {
      current.superLikes.push(target);
      current.superLikeTimestamps.push(now);
      await current.save();
    }
    res.json({ message: "Superliked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

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

      res.json(user);
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
router.get("/all", authenticateToken, async (req, res) => {
  try {
    const list = await User.find({ _id: { $ne: req.userId } }).select("username profilePicture");
    res.json(list);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
// --- REPLACE END ---

// --- REPLACE START: validate :id to avoid 'profile' hitting this route ---
router.param("id", (_req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  return next();
});
// --- REPLACE END ---

// ✅ Public profile by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Public profile fetch error:", err?.message || err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- REPLACE START: ESM export default router ---
export default router;
// --- REPLACE END ---
