const express = require("express");
const router = express.Router();
require("dotenv").config();

const path = require("path");
const fs = require("fs");

const User = require("../models/User");
const Subscription = require("../models/Subscription");
const Image = require("../models/Image");
const authenticateToken = require("../middleware/auth");

const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
} = require("../controllers/userController");

// =====================
// ✅ Rekisteröi käyttäjä
// =====================
router.post("/register", registerUser);

// =====================
// ✅ Kirjaudu sisään
// =====================
router.post("/login", loginUser);

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
// ✅ Päivitä profiili (teksti + lifestyle + metrics + location)
// =====================
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });

    // Määritellään eri kenttäkategoriat
    const textFields = [
      "username", "email", "gender", "orientation",
      "education", "profession", "religion", "religionImportance",
      "children", "pets", "summary", "goal", "lookingFor",
      "country", "region", "city", "customCountry", "customRegion", "customCity",
      "smoke", "drink", "drugs"
    ];
    const numberFields = ["age", "height", "weight", "latitude", "longitude"];
    const singleSelectFields = ["bodyType", "activityLevel"];
    const arrayFields = ["nutritionPreferences"];
    const longTextFields = ["healthInfo"];

    // Päivitä tekstikentät
    textFields.forEach(f => {
      if (req.body[f] !== undefined) {
        user[f] = req.body[f];
      }
    });

    // Päivitä numeeriset kentät
    numberFields.forEach(f => {
      if (req.body[f] !== undefined) {
        const n = Number(req.body[f]);
        user[f] = isNaN(n) ? null : n;
      }
    });

    // Päivitä yksivalintaiset drop-down kentät
    singleSelectFields.forEach(f => {
      if (req.body[f] !== undefined) {
        user[f] = req.body[f];
      }
    });

    // Päivitä monivalinnat (nutritionPreferences), hyväksyy sekä arrayn että stringin
    arrayFields.forEach(f => {
      if (Array.isArray(req.body[f])) {
        user[f] = req.body[f];
      } else if (typeof req.body[f] === "string") {
        user[f] = [req.body[f]];
      }
    });

    // Päivitä pitkät tekstikentät
    longTextFields.forEach(f => {
      if (req.body[f] !== undefined) {
        user[f] = req.body[f];
      }
    });

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (err) {
    console.error("Profiilin päivitysvirhe:", err);
    res.status(500).json({ error: err.message || "Profiilin päivitys epäonnistui" });
  }
});

// =====================
// ✅ Piilota / Paljasta oma profiili
// =====================
router.put("/profile/hide", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });

    user.hidden = !user.hidden;
    await user.save();
    res.json({ hidden: user.hidden });
  } catch (err) {
    console.error("Piilotusvirhe:", err);
    res.status(500).json({ error: "Profiilin piilotus epäonnistui" });
  }
});

// =====================
// ✅ Discover: muut käyttäjät
// =====================
router.get("/all", authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId }, hidden: { $ne: true } })
      .select("username email profilePicture extraImages");
    res.json(users);
  } catch (err) {
    console.error("Discover-haku epäonnistui:", err);
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

// =====================
// ✅ Premium: Who liked me
// =====================
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser.isPremium) {
      return res.status(403).json({ error: "Vain Premium-käyttäjille." });
    }
    const users = await User.find({ likes: req.userId }).select("username email profilePicture");
    res.json(users);
  } catch (err) {
    console.error("Who-liked-me virhe:", err);
    res.status(500).json({ error: "Palvelinvirhe." });
  }
});

// =====================
// 🔍 Sijaintihaku (regex ja hidden check)
// =====================
router.get("/nearby", authenticateToken, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "City is required" });

    const users = await User.find({
      city: { $regex: new RegExp(city, "i") },
      hidden: { $ne: true }
    }).select("-password");

    res.json(users);
  } catch (err) {
    console.error("Nearby-haku epäonnistui:", err);
    res.status(500).json({ error: "Failed to fetch nearby users" });
  }
});

// =====================
// ✅ ADMIN: Kaikki käyttäjät
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
// ✅ Julkinen profiili (/:id)
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
    // Poistetaan vanhat timestampit (yli 48h)
    currentUser.superLikeTimestamps = currentUser.superLikeTimestamps.filter(
      ts => now - new Date(ts) < 48 * 60 * 60 * 1000
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
// ✅ Estä käyttäjä
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
// 📸 Upload extra photos
// =====================
router.post("/:id/upload-photos", authenticateToken, uploadExtraPhotos);

// =====================
// ✅ ADMIN: Näytä/Piilota käyttäjä
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
// ✅ Poista oma profiili
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
