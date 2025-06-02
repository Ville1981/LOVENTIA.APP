const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const multer = require("multer");
const path = require("path");
const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

// 🔧 Multer tallennus
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/upgrade-premium", authMiddleware, upgradeToPremium);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ Profiilin päivitys
router.put(
  "/profile",
  authMiddleware,
  upload.any(),
  async (req, res) => {
    try {
      console.log("🟡 PUT /profile saapui");
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });

      if (!req.body.username || req.body.username.trim() === "") {
        return res.status(400).json({ error: "Käyttäjänimi on pakollinen" });
      }

      const fields = [
        "username", "name", "email", "age", "gender", "height", "weight",
        "status", "religion", "religionImportance", "children", "pets", "summary", "goal",
        "lookingFor", "location", "latitude", "longitude",
        "education", "profession", "country", "region", "city",
        "preferredGender", "preferredMinAge", "preferredMaxAge"
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined && req.body[field] !== "") {
          user[field] = req.body[field];
        }
      });

      if (req.body.preferredInterests) {
        const prefs = Array.isArray(req.body.preferredInterests)
          ? req.body.preferredInterests
          : req.body.preferredInterests.split(",");
        user.preferredInterests = prefs.map((s) => s.trim());
      }

      if (req.body.interests) {
        const ints = Array.isArray(req.body.interests)
          ? req.body.interests
          : req.body.interests.split(",");
        user.interests = ints.map((s) => s.trim());
      }

      const mainImage = req.files.find(f => f.fieldname === "image");
      const extraImages = req.files.filter(f => f.fieldname === "extraImages");

      if (mainImage) {
        user.profilePicture = mainImage.path;
      }

      if (extraImages.length > 0) {
        user.extraImages = extraImages.map(f => f.path);
      }

      const updated = await user.save();
      res.json(updated);
    } catch (err) {
      console.error("❌ Profiilin tallennusvirhe:", err);
      res.status(500).json({ error: "Profiilin tallennus epäonnistui" });
    }
  }
);

// ✅ Tilin poisto
router.delete("/delete", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Tili poistettu onnistuneesti" });
  } catch (err) {
    res.status(500).json({ error: "Tilin poisto epäonnistui" });
  }
});

// ✅ Matchit
router.get("/matches", authMiddleware, getMatchesWithScore);

// ✅ Julkinen profiili
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

module.exports = router;