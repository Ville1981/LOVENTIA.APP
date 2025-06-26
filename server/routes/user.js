// server/routes/users.js

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

// 🔐 Middleware: varmista tokenin aitous
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

// 🔧 Multer storage + tiedostonpoisto
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// =====================
// ✅ Rekisteröinti / login
// =====================
router.post("/register", registerUser);
router.post("/login", loginUser);

// =====================
// ✅ Hae oma profiili
// =====================
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// =====================
// ✅ Profiilin päivitys
// =====================
router.put(
  "/profile",
  authenticateToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "extraImages", maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Lista kaikista päivitettävistä kentistä
      const fields = [
        "username", "email", "age", "gender", "orientation",
        "education", "height", "weight", "status", "religion",
        "religionImportance", "children", "pets", "summary", "goal",
        "lookingFor", "profession", "location", "country", "region",
        "city", "latitude", "longitude",             // koordinaatit
        "smoke", "drink", "drugs",                   // lifestyle
        "bodyType", "activityLevel",                 // metrics
        "nutritionPreferences", "healthInfo",        // health
        "interests", "preferredGender", "preferredMinAge",
        "preferredMaxAge", "preferredInterests", "preferredCountry",
        "preferredReligion", "preferredReligionImportance",
        "preferredEducation", "preferredProfession"
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          // array-kentät käsitellään pilkulla eroteltuna merkkijonona tai valmiina taulukkona
          if (["interests", "preferredInterests", "nutritionPreferences"].includes(field)) {
            user[field] = Array.isArray(req.body[field])
              ? req.body[field]
              : typeof req.body[field] === "string"
                ? req.body[field].split(",").map((s) => s.trim())
                : [];
          } else {
            user[field] = req.body[field];
          }
        }
      });

      // Profiilikuva
      if (req.files?.profilePhoto?.length) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // Lisäkuvat
      if (req.files?.extraImages?.length) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      const updated = await user.save();
      res.json(updated);
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed" });
    }
  }
);

// =====================
// ✅ Profiili ID:llä
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
// ✅ Kaikki muut käyttäjät (kotiin, Discoveriin)
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

// =====================
// ❤️ Like
// =====================
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

// =====================
// 🌟 Superlike
// =====================
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

// =====================
// 🚫 Estä käyttäjä
// =====================
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

// =====================
// 💎 Premium
// =====================
router.post("/upgrade-premium", authenticateToken, upgradeToPremium);

// =====================
// 👀 Kuka tykkäsi minusta
// =====================
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

// =====================
// 📍 Lähialueen käyttäjät (koordinaattien perusteella)
// =====================
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

// =====================
// 🖼 Kuvien käsittely
// =====================
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
