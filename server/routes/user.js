const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
// --- REPLACE START: load ESM controller via dynamic import (Jest/CJS compatible) ---
const path = require("path");
const { pathToFileURL } = require("url");

function toURL(p) {
  return pathToFileURL(path.resolve(__dirname, p)).href;
}
const userControllerURL = toURL("../controllers/userController.js");

let _ucPromise = null;
function loadUserController() {
  if (!_ucPromise) _ucPromise = import(userControllerURL);
  return _ucPromise;
}

async function registerUser(req, res, next) {
  try {
    const m = await loadUserController();
    return m.registerUser(req, res, next);
  } catch (err) { return next(err); }
}
async function loginUser(req, res, next) {
  try {
    const m = await loadUserController();
    return m.loginUser(req, res, next);
  } catch (err) { return next(err); }
}
async function getMatchesWithScore(req, res, next) {
  try {
    const m = await loadUserController();
    return m.getMatchesWithScore(req, res, next);
  } catch (err) { return next(err); }
}
async function upgradeToPremium(req, res, next) {
  try {
    const m = await loadUserController();
    return m.upgradeToPremium(req, res, next);
  } catch (err) { return next(err); }
}
async function uploadExtraPhotos(req, res, next) {
  try {
    const m = await loadUserController();
    return m.uploadExtraPhotos(req, res, next);
  } catch (err) { return next(err); }
}
async function uploadPhotoStep(req, res, next) {
  try {
    const m = await loadUserController();
    return m.uploadPhotoStep(req, res, next);
  } catch (err) { return next(err); }
}
async function deletePhotoSlot(req, res, next) {
  try {
    const m = await loadUserController();
    return m.deletePhotoSlot(req, res, next);
  } catch (err) { return next(err); }
}
// --- REPLACE END ---
const multer = require("multer");
const pathFs = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");

// 🔐 Middleware: ensure token validity
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// 🎯 JSON-body parser
router.use(express.json());

// 🔧 Multer storage + file removal helper
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + pathFs.extname(file.originalname)),
});
const upload = multer({ storage });

function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

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
    body('username').optional().notEmpty().withMessage('Username is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('age').optional().isInt({ min: 18 }).withMessage('Age must be at least 18'),
    body('gender').optional().notEmpty().withMessage('Gender is required'),
    body('orientation').optional().notEmpty().withMessage('Orientation is required'),
    body('height').optional().isNumeric().withMessage('Height must be a number'),
    body('weight').optional().isNumeric().withMessage('Weight must be a number'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('professionCategory')
      .optional({ checkFalsy: true })
      .isIn([
        '',
        'Administration',
        'Finance',
        'Military',
        'Technical',
        'Healthcare',
        'Education',
        'Entrepreneur',
        'Law',
        'Farmer/Forest worker',
        'Theologian/Priest',
        'Service',
        'Artist',
        'DivineServant',
        'Homeparent',
        'Service',
        'FoodIndustry',
        'Retail',
        'Arts',
        'Government',
        'Retired',
        'Athlete',
        'Other',
      ])
      .withMessage('Invalid profession category'),
    body('nutritionPreferences')
      .optional()
      .isArray().withMessage('Nutrition preferences must be an array'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Fields to update
      const fields = [
        "username", "email", "age", "gender", "orientation",
        "education", "height", "weight", "status", "religion",
        "religionImportance", "children", "pets", "summary", "goal",
        "lookingFor", "profession", "professionCategory",
        "heightUnit",
        "country", "region", "city",
        "latitude", "longitude",
        "smoke", "drink", "drugs",
        "bodyType", "activityLevel",
        "nutritionPreferences", "healthInfo",
        "interests", "preferredGender", "preferredMinAge",
        "preferredMaxAge", "preferredInterests", "preferredCountry",
        "preferredReligion", "preferredReligionImportance",
        "preferredEducation", "preferredProfession", "preferredChildren"
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
            if (Array.isArray(req.body[field])) {
              user[field] = req.body[field];
            } else if (typeof req.body[field] === "string") {
              user[field] = [req.body[field]];
            } else {
              user[field] = [];
            }
          } else {
            user[field] = req.body[field];
          }
        }
      });

      // --- REPLACE START: map top-level country/region/city into nested location before save ---
      /**
       * Ensure that profile form's top-level "country/region/city" end up in the
       * canonical nested schema: user.location.{country,region,city}.
       * This works even if the Mongoose model does not define top-level virtuals.
       */
      if (
        req.body.country !== undefined ||
        req.body.region !== undefined ||
        req.body.city !== undefined
      ) {
        user.location = user.location || {};
        if (req.body.country !== undefined) user.location.country = req.body.country;
        if (req.body.region !== undefined)  user.location.region  = req.body.region;
        if (req.body.city !== undefined)    user.location.city    = req.body.city;
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

// =====================
/* ✅ Public profile by ID */
// =====================
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
/* ✅ All other users (for home, discover) */
// =====================
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const list = await User.find({ _id: { $ne: req.userId } }).select(
      "username profilePicture"
    );
    res.json(list);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ❤️ Like
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
    if (!current.likes.includes(target)) {
      current.likes.push(target);
      await current.save();
    }
    res.json({ message: "Liked successfully" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// 🌟 Superlike
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target = req.params.id;
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
    if (me._id.equals(blockId))
      return res.status(400).json({ message: "Cannot block yourself" });
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// 💎 Premium upgrade
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);

// 👀 Who liked me
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me.isPremium) return res.status(403).json({ error: "Premium only" });
    const likers = await User.find({ likes: req.userId }).select(
      "username profilePicture"
    );
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
    if (!user || !user.latitude || !user.longitude) {
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
      const dLat = toRad(u.latitude - user.latitude);
      const dLon = toRad(u.longitude - user.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(user.latitude)) *
          Math.cos(toRad(u.latitude)) *
          Math.sin(dLon / 2) ** 2;
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

// 🖼 Image handling
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (req.userId !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

router.post(
  "/:id/upload-photos",
  authenticateToken,
  upload.array("photos", 20),
  uploadExtraPhotos
);

router.post(
  "/:id/upload-photo-step",
  authenticateToken,
  upload.single("photo"),
  uploadPhotoStep
);

router.delete(
  "/:id/photos/:slot",
  authenticateToken,
  deletePhotoSlot
);

module.exports = router;
