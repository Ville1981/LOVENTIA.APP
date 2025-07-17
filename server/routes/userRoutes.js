// routes/userRoutes.js

const express           = require("express");
const router            = express.Router();
const path              = require("path");
const fs                = require("fs");
const jwt               = require("jsonwebtoken");
const mongoose          = require("mongoose");
const multer            = require("multer");
const { body, validationResult } = require("express-validator");
const User              = require("../models/User");

const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
} = require("../controllers/userController");

// 🔐 Middleware: ensure token validity and attach user
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    req.userId = user._id;
    req.user   = user;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// 🔧 Multer storage + helper
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload     = multer({ storage });
const removeFile = filePath => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// 🎯 Body parsers
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// =====================
// 🚪 Authentication routes
// =====================
router.post("/register", registerUser);
router.post("/login",    loginUser);

// =====================
// 👤 Get current user (/api/users/me)
// =====================
router.get("/me", authenticateToken, (req, res) => {
  res.json(req.user);
});

// =====================
// 🆔 Alias for current user (/api/users/profile)
// =====================
router.get("/profile", authenticateToken, (req, res) => {
  res.json(req.user);
});

// =====================
// ✏️ Update profile (/api/users/profile)
// =====================
const profileValidation = [
  // add your express-validator checks here, e.g.:
  // body("username").isLength({ min: 3 }).withMessage("Username too short"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    next();
  }
];
router.put(
  "/profile",
  authenticateToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages",  maxCount: 20 }
  ]),
  profileValidation,
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      // ... apply updates from req.body/file uploads ...
      const updated = await user.save();
      res.json(updated);
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed" });
    }
  }
);

// =====================
// ❤️ Like another user
// =====================
router.post("/like/:id", authenticateToken, async (req, res) => {
  // ...
});

// =====================
// 🌟 Superlike another user
// =====================
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  // ...
});

// 🚫 Block user
router.post("/block/:id", authenticateToken, async (req, res) => {
  // ...
});

// 💎 Upgrade to premium
router.post("/upgrade-premium", authenticateToken, async (req, res) => {
  await upgradeToPremium(req, res);
});

// 👀 Who liked me
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  // ...
});

// 📍 Nearby users
router.get("/nearby", authenticateToken, async (req, res) => {
  // ...
});

// 🖼 Upload avatar
router.post(
  "/:id/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    // ...
  }
);

// 🖼 Upload photos
router.post(
  "/:id/upload-photos",
  authenticateToken,
  upload.array("photos", 20),
  uploadExtraPhotos
);

// 🖼 Upload single photo step
router.post(
  "/:id/upload-photo-step",
  authenticateToken,
  upload.single("photo"),
  uploadPhotoStep
);

// 🖼 Delete photo slot
router.delete(
  "/:id/photos/:slot",
  authenticateToken,
  deletePhotoSlot
);

// =====================
// 💡 Param validator: catch invalid ObjectIds early
// =====================
router.param("id", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }
  next();
});

// =====================
// 🆔 Public profile by ID (always last)
// =====================
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -email -likes -superLikes -blockedUsers");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET /:id failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
