const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { registerUser, loginUser } = require("../controllers/userController");
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
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// 🎯 JSON-parsin middleware profiilitietojen päivitykselle
router.use(express.json());

// 🔧 Multer-tiedostojen tallennus
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ✅ Rekisteröi käyttäjä
router.post("/register", registerUser);

// ✅ Kirjaudu sisään
router.post("/login", loginUser);

// ✅ Hae nykyisen käyttäjän tiedot
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ Päivitä profiili (kaikki uudet kentät mukana)
router.put(
  "/profile",
  authenticateToken,
  express.json(),
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "extraImages", maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy" });

      // Kaikki frontista tulevat kentät
      const fields = [
        "username", "email", "age", "gender", "orientation", "education",
        "height", "weight", "status", "religion", "religionImportance",
        "children", "pets", "summary", "goal", "lookingFor", "profession",
        "location", "country", "region", "city",
        "interests", "preferredGender", "preferredMinAge", "preferredMaxAge",
        "preferredInterests", "preferredCountry", "preferredReligion",
        "preferredReligionImportance", "preferredEducation", "preferredProfession"
      ];

      // Päivitä kentät
      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          if (["interests", "preferredInterests"].includes(field)) {
            user[field] =
              typeof req.body[field] === "string"
                ? req.body[field].split(",").map((s) => s.trim())
                : req.body[field];
          } else {
            user[field] = req.body[field];
          }
        }
      });

      // Avatar
      if (req.files && req.files['image']) {
        user.profilePicture = req.files['image'][0].path;
      }
      // Lisäkuvat
      if (req.files && req.files['extraImages']) {
        user.extraImages = req.files['extraImages'].map((f) => f.path);
      }

      const updatedUser = await user.save();
      res.json(updatedUser);
    } catch (err) {
      console.error("Profiilin päivitysvirhe:", err);
      res.status(500).json({ error: "Profiilin päivitys epäonnistui" });
    }
  }
);

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

// ✅ Discover
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "name email profilePicture"
    );
    res.json(users);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ✅ Like
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const targetUserId = req.params.id;
    if (!currentUser.likes.includes(targetUserId)) {
      currentUser.likes.push(targetUserId);
      await currentUser.save();
    }
    res.json({ message: "Liked successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Superlike
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const targetUserId = req.params.id;
    const now = new Date();

    if (!currentUser.superLikeTimestamps) currentUser.superLikeTimestamps = [];
    currentUser.superLikeTimestamps = currentUser.superLikeTimestamps.filter(
      (ts) => now - new Date(ts) < 48 * 60 * 60 * 1000
    );

    const limit = currentUser.isPremium ? 3 : 1;
    if (currentUser.superLikeTimestamps.length >= limit) {
      return res.status(403).json({ error: `Superlike-raja saavutettu (${limit} / 48h).` });
    }

    if (!currentUser.superLikes.includes(targetUserId)) {
      currentUser.superLikes.push(targetUserId);
      currentUser.superLikeTimestamps.push(now);
      await currentUser.save();
    }

    res.json({ message: "Superliked successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Estä toinen käyttäjä
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const blocker = await User.findById(req.userId);
    const blockedId = req.params.id;
    if (!blocker || blocker._id.equals(blockedId)) return res.status(400).json({ message: "Et voi estää itseäsi." });
    if (blocker.blockedUsers.includes(blockedId)) return res.status(400).json({ message: "Käyttäjä on jo estetty." });
    blocker.blockedUsers.push(blockedId);
    await blocker.save();
    res.json({ message: "Käyttäjä estetty onnistuneesti." });
  } catch (err) {
    res.status(500).json({ message: "Virhe estossa." });
  }
});

// ✅ Premium-upgrade
router.post("/upgrade-premium", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löytynyt" });
    user.isPremium = true;
    await user.save();
    res.json({ message: "Premium-tila päivitetty onnistuneesti" });
  } catch (err) {
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

// ✅ Who liked me
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser.isPremium) return res.status(403).json({ error: "Vain Premium-käyttäjille." });
    const users = await User.find({ likes: req.userId }).select("name email profilePicture");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Palvelinvirhe." });
  }
});

// 🔍 Sijaintihaku
router.get("/nearby", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "City is required" });
    const users = await User.find({ location: city }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch nearby users" });
  }
});

// ✅ ADMIN
router.get("/admin/users", authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.put("/admin/hide/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Käyttäjää ei löytynyt" });
    user.hidden = !user.hidden;
    await user.save();
    res.json({ message: `Käyttäjä ${user.hidden ? "piilotettu" : "näkyväksi muutettu"}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user visibility" });
  }
});

router.delete("/admin/:id", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Käyttäjä poistettu" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ✅ Poista käyttäjätili
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
