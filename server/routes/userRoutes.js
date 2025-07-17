// routes/userRoutes.js

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
} = require("../controllers/userController");
const multer = require("multer");
const path = require("path");
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
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });
function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// =====================
// ✅ Auth routes
// =====================
router.post("/register", registerUser);
router.post("/login", loginUser);

// =====================
// ✅ Mock (dev) users
// =====================
router.get("/mock-users", (req, res) => {
  // …your mock-users handler…
  res.json([]);
});

// =====================
// ✅ Get own profile
// =====================
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("-password");
    res.json(me);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// =====================
// ✅ Get own profile details
// =====================
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("-password");
    if (!me) return res.status(404).json({ error: "User not found" });
    res.json(me);
  } catch (err) {
    console.error("GET /profile failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// ✅ All other users (for home/discover)
// =====================
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const list = await User.find({ _id: { $ne: req.userId } }).select(
      "username profilePicture"
    );
    res.json(list);
  } catch (err) {
    console.error("GET /users/all failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// ✅ Profile update with validation
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
    body("age")
      .optional()
      .isInt({ min: 18 })
      .withMessage("Age must be at least 18"),
    body("gender").optional().notEmpty().withMessage("Gender is required"),
    body("orientation")
      .optional()
      .notEmpty()
      .withMessage("Orientation is required"),

    body("height").optional().isNumeric().withMessage("Height must be a number"),
    body("heightUnit")
      .optional({ checkFalsy: true })
      .isIn(["Cm", "FtIn"])
      .withMessage("Invalid height unit"),

    body("weight").optional().isNumeric().withMessage("Weight must be a number"),
    body("weightUnit")
      .optional({ checkFalsy: true })
      .isIn(["kg", "lb", "Kg", "Lb"])
      .withMessage("Invalid weight unit"),

    body("latitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -90, max: 90 })
      .withMessage("Invalid latitude"),
    body("longitude")
      .optional({ checkFalsy: true })
      .isFloat({ min: -180, max: 180 })
      .withMessage("Invalid longitude"),

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
        "Service",
        "Other",
        "Farmer/Forest worker",
        "Theologian/Priest",
        "Artist",
        "Athlete",
        "DivineServant",
        "Homeparent",
        "FoodIndustry",
        "Retail",
        "Arts",
        "Government",
        "Retired",
      ])
      .withMessage("Invalid profession category"),

    body("nutritionPreferences")
      .optional()
      .isArray()
      .withMessage("Nutrition preferences must be an array"),
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

      // ─── Handle front-end lifestyle fields ────────────────────────
      // (jos joskus käytetään avaimia lifestyle.xxx)
      const lifestyleMap = {
        smoke: "smoke",
        drink: "drink",
        drugs: "drugs",
        diet: "nutritionPreferences",
        dietOmnivore: "nutritionPreferences",
        exercise: "activityLevel",
        exerciseWeekly: "activityLevel",
      };
      Object.keys(req.body).forEach((key) => {
        if (key.startsWith("lifestyle.")) {
          const sub = key.split(".")[1];
          const prop = lifestyleMap[sub];
          if (prop) user[prop] = req.body[key];
        }
      });

      // ─── Fields to update ────────────────────────────────────────
      const fields = [
        "username",
        "email",
        "age",
        "gender",
        "orientation",
        "education",
        "height",
        "heightUnit",
        "weight",
        "weightUnit",
        "status",
        "religion",
        "religionImportance",
        "children",
        "pets",
        // Lisätty, jotta nämä tallentuvat:
        "smoke",
        "drink",
        "drugs",
        "summary",
        "goal",
        "lookingFor",
        "profession",
        "professionCategory",
        "country",
        "region",
        "city",
        "customCountry",
        "customRegion",
        "customCity",
        "latitude",
        "longitude",
        "bodyType",
        "activityLevel",
        "nutritionPreferences",
        "healthInfo",
        "interests",
        "preferredGender",
        "preferredMinAge",
        "preferredMaxAge",
        "preferredInterests",
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

      // ─── Profile photo upload ──────────────────────────────────
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // ─── Extra images upload ───────────────────────────────────
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      const updated = await user.save();
      return res.json(updated);
    } catch (err) {
      console.error("Profile update error:", err);
      return res
        .status(500)
        .json({ error: "Profile update failed", details: err.message });
    }
  }
);

// =====================
// ❤️ Like another user
// =====================
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const target = req.params.id;
    if (!me.likes.includes(target)) {
      me.likes.push(target);
      await me.save();
    }
    res.json({ message: "Liked successfully" });
  } catch (err) {
    console.error("POST /like/:id failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// 🌟 Superlike
// =====================
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const now = new Date();
    me.superLikeTimestamps = (me.superLikeTimestamps || []).filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );
    const limit = me.isPremium ? 3 : 1;
    if (me.superLikeTimestamps.length >= limit) {
      return res.status(403).json({ error: "Superlike limit reached" });
    }
    const target = req.params.id;
    if (!me.superLikes.includes(target)) {
      me.superLikes.push(target);
      me.superLikeTimestamps.push(now);
      await me.save();
    }
    res.json({ message: "Superliked successfully" });
  } catch (err) {
    console.error("POST /superlike/:id failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// 🚫 Block user
// =====================
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const blockId = req.params.id;
    if (me._id.equals(blockId)) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch (err) {
    console.error("POST /block/:id failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// 💎 Upgrade to premium
// =====================
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);

// =====================
// 👀 Who liked me
// =====================
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me.isPremium) return res.status(403).json({ error: "Premium only" });
    const likers = await User.find({ likes: req.userId }).select(
      "username profilePicture"
    );
    res.json(likers);
  } catch (err) {
    console.error("GET /who-liked-me failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// 📍 Nearby users within 50 km
// =====================
router.get("/nearby", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const maxDist = 50; // km
    if (!me?.latitude || !me?.longitude) {
      return res.status(400).json({ error: "User location is missing" });
    }
    const others = await User.find({ _id: { $ne: req.userId } }).select(
      "-password"
    );
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const nearby = others.filter((u) => {
      if (!u.latitude || !u.longitude) return false;
      const dLat = toRad(u.latitude - me.latitude);
      const dLon = toRad(u.longitude - me.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(me.latitude)) *
          Math.cos(toRad(u.latitude)) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c <= maxDist;
    });
    res.json(nearby);
  } catch (err) {
    console.error("GET /nearby failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// 🖼 Image handling
// =====================
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (req.userId !== id)
        return res.status(403).json({ error: "Forbidden" });
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      removeFile(user.profilePicture);
      user.profilePicture = req.file.path;
      await user.save();
      res.json(user);
    } catch (err) {
      console.error("POST /:id/upload-avatar failed:", err);
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
