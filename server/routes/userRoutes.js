const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Image = require("../models/Image");
const authenticateToken = require("../middleware/auth");
// File upload handled in separate routes (imageRoutes.js)
const path = require("path");
const fs = require("fs");

const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
} = require("../controllers/userController");

require("dotenv").config();

// =====================
// ✅ Rekisteröi käyttäjä
// =====================
router.post("/register", registerUser);

// =====================
// ✅ Kirjaudu sisään
// =====================
router.post("/login", loginUser);

// =====================
// ✅ Lataa lisäkuvat erikseen
// =====================
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  // multer middleware defined in imageRoutes.js
  uploadExtraPhotos
);

// =====================
// ✅ Hae nykyisen käyttäjän tiedot
// =====================
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// =====================
// ✅ Päivitä profiili (vain tekstikentät)
// =====================
router.put(
  "/profile",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });

      // Päivitä tekstit
      const textFields = [
        "username", "email", "age", "gender", "orientation",
        "education", "profession", "religion", "religionImportance",
        "children", "pets", "summary", "goal", "lookingFor",
        "country", "region", "city"
      ];
      textFields.forEach(field => {
        if (req.body[field] !== undefined) user[field] = req.body[field];
      });

      // Tallennetaan muutokset
      const updatedUser = await user.save();
      res.json(updatedUser);
    } catch (err) {
      console.error("Profiilin päivitysvirhe:", err.stack);
      res.status(500).json({ error: "Profiilin päivitys epäonnistui" });
    }
  }
);

// =====================
// ✅ Lataa lisäkuvat erikseen (duplicate removal)
// =====================
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  uploadExtraPhotos
);

// =====================
// ✅ Haetaan Discover-sivun käyttäjät
// =====================
router.get("/all", authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "name email profilePicture extraImages"
    );
    res.json(users);
  } catch (err) {
    console.error("Discover-haku epäonnistui:", err.stack);
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});
// =====================
// ✅ Who liked me (Premium)
// =====================
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser.isPremium) {
      return res.status(403).json({ error: "Vain Premium-käyttäjille." });
    }
    const users = await User.find({ likes: req.userId }).select(
      "name email profilePicture"
    );
    res.json(users);
  } catch (err) {
    console.error("Who-liked-me virhe:", err);
    res.status(500).json({ error: "Palvelinvirhe." });
  }
});

// =====================
// 🔍 Sijaintihaku
// =====================
router.get("/nearby", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "City is required" });
    const users = await User.find({ location: city }).select("-password");
    res.json(users);
  } catch (err) {
    console.error("Nearby-haku epäonnistui:", err);
    res.status(500).json({ error: "Failed to fetch nearby users" });
  }
});

// =====================
// ✅ ADMIN: Hae kaikki käyttäjät
// =====================
router.get("/admin/users", authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    console.error("Admin users haku epäonnistui:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// =====================
// ✅ Julkinen profiili (id-parametri)
// =====================
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers -extraImages"
    );
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });
    res.json(user);
  } catch (err) {
    console.error("Julkinen profiili epäonnistui:", err);
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

// =====================
// ✅ Like
// =====================
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const targetId = req.params.id;
    if (!currentUser.likes.includes(targetId)) {
      currentUser.likes.push(targetId);
      await currentUser.save();
    }
    res.json({ message: "Liked successfully" });
  } catch (err) {
    console.error("Like-virhe:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// ✅ Superlike
// =====================
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const targetId = req.params.id;
    const now = new Date();

    if (!currentUser.superLikeTimestamps) currentUser.superLikeTimestamps = [];
    currentUser.superLikeTimestamps = currentUser.superLikeTimestamps.filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );

    const limit = currentUser.isPremium ? 3 : 1;
    if (currentUser.superLikeTimestamps.length >= limit) {
      return res.status(403).json({ error: `Superlike-raja saavutettu (${limit}/48h).` });
    }

    if (!currentUser.superLikes.includes(targetId)) {
      currentUser.superLikes.push(targetId);
      currentUser.superLikeTimestamps.push(now);
      await currentUser.save();
    }

    res.json({ message: "Superliked successfully!" });
  } catch (err) {
    console.error("Superlike-virhe:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// ✅ Estä toinen käyttäjä
// =====================
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const blocker = await User.findById(req.userId);
    const blockedId = req.params.id;
    if (!blocker || blocker._id.equals(blockedId)) {
      return res.status(400).json({ message: "Et voi estää itseäsi." });
    }
    if (!blocker.blockedUsers.includes(blockedId)) {
      blocker.blockedUsers.push(blockedId);
      await blocker.save();
    }
    res.json({ message: "Käyttäjä estetty onnistuneesti." });
  } catch (err) {
    console.error("Block-virhe:", err);
    res.status(500).json({ message: "Virhe estossa." });
  }
});

// =====================
// ✅ Premium-upgrade
// =====================
router.post("/upgrade-premium", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydetty" });
    user.isPremium = true;
    await user.save();
    res.json({ message: "Premium-tila päivitetty onnistuneesti" });
  } catch (err) {
    console.error("Premium-upgrade virhe:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================
// ✅ ADMIN: Piilota/näytä käyttäjä
// =====================
router.put("/admin/hide/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydetty" });
    user.hidden = !user.hidden;
    await user.save();
    res.json({ message: `Käyttäjä ${user.hidden ? "piilotettu" : "näkyväksi muutettu"}` });
  } catch (err) {
    console.error("Hide-virhe:", err);
    res.status(500).json({ error: "Failed to update user visibility" });
  }
});

// =====================
// ✅ ADMIN: Poista käyttäjä
// =====================
router.delete("/admin/:id", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Käyttäjä poistettu" });
  } catch (err) {
    console.error("Admin-delete virhe:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// =====================
// ✅ Poista oma käyttäjätili
// =====================
router.delete("/profile", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Käyttäjätili poistettu onnistuneesti" });
  } catch (err) {
    console.error("Tilin poisto epäonnistui:", err);
    res.status(500).json({ error: "Tilin poisto epäonnistui" });
  }
});

module.exports = router;

