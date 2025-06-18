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

// 🎯 JSON-body parser
router.use(express.json());

// 🔧 Multer storage + filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ⚙ Utility: poista tiedosto levyltä
function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// =====================
// = Perusreitit =
// =====================

// Rekisteröi käyttäjä
router.post("/register", registerUser);

// Kirjaudu sisään
router.post("/login", loginUser);

// Hae nykyinen käyttäjä
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Päivitä profiili (kentät + avatar + bulk extraImages)
router.put(
  "/profile",
  authenticateToken,
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },  // ← muutettu vastaamaan fronttia
    { name: "extraImages",  maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Päivitä peruskentät
      const fields = [
        "username","email","age","gender","orientation","education",
        "height","weight","status","religion","religionImportance",
        "children","pets","summary","goal","lookingFor","profession",
        "location","country","region","city",
        "interests","preferredGender","preferredMinAge","preferredMaxAge",
        "preferredInterests","preferredCountry","preferredReligion",
        "preferredReligionImportance","preferredEducation","preferredProfession"
      ];
      fields.forEach(field => {
        if (req.body[field] !== undefined) {
          if (["interests","preferredInterests"].includes(field)) {
            user[field] = Array.isArray(req.body[field])
              ? req.body[field]
              : req.body[field].split(",").map(s => s.trim());
          } else {
            user[field] = req.body[field];
          }
        }
      });

      // Avatar‐päivitys (PUT /profile)
      if (req.files && req.files.profilePhoto) {
        removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // Bulk extraImages
      if (req.files && req.files.extraImages) {
        (user.extraImages || []).forEach(removeFile);
        user.extraImages = req.files.extraImages.map(f => f.path);
      }

      const updated = await user.save();
      res.json(updated);
    } catch (err) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Profile update failed" });
    }
  }
);

// Julkinen profiili
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -likes -superLikes -blockedUsers"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Discover (kaikki muut paitsi itse)
router.get("/users/all", authenticateToken, async (req, res) => {
  try {
    const list = await User.find({ _id: { $ne: req.userId } }).select(
      "username profilePicture"
    );
    res.json(list);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Like
router.post("/like/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target  = req.params.id;
    if (!current.likes.includes(target)) {
      current.likes.push(target);
      await current.save();
    }
    res.json({ message: "Liked successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Superlike
router.post("/superlike/:id", authenticateToken, async (req, res) => {
  try {
    const current = await User.findById(req.userId);
    const target  = req.params.id;
    const now     = new Date();
    current.superLikeTimestamps = (current.superLikeTimestamps || [])
      .filter(ts => now - new Date(ts) < 48 * 60 * 60 * 1000);
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
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Block user
router.post("/block/:id", authenticateToken, async (req, res) => {
  try {
    const me      = await User.findById(req.userId);
    const blockId = req.params.id;
    if (me._id.equals(blockId))
      return res.status(400).json({ message: "Cannot block yourself" });
    if (!me.blockedUsers.includes(blockId)) {
      me.blockedUsers.push(blockId);
      await me.save();
    }
    res.json({ message: "User blocked" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Upgrade to premium
router.post("/upgrade-premium", authenticateToken, async (req, res) => {
  try {
    const u = await User.findById(req.userId);
    u.isPremium = true;
    await u.save();
    res.json({ message: "Premium updated" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Who liked me (premium only)
router.get("/who-liked-me", authenticateToken, async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me.isPremium) return res.status(403).json({ error: "Premium only" });
    const likers = await User.find({ likes: req.userId }).select(
      "username profilePicture"
    );
    res.json(likers);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Nearby search
router.get("/nearby", async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: "City required" });
    const users = await User.find({ city }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: list users
router.get("/admin/users", authenticateToken, async (req, res) => {
  try {
    const all = await User.find().select("-password");
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: hide/unhide
router.put("/admin/hide/:id", authenticateToken, async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    u.hidden = !u.hidden;
    await u.save();
    res.json({ message: `User ${u.hidden ? "hidden" : "visible"}` });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin: delete user
router.delete("/admin/:id", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete own account
router.delete("/profile", authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Account deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// ==============================
// = Kuvien upload- ja delete =
// ==============================

/**
 * Profiiliavatar
 * Client kutsuu uploadAvatar() → POST /api/users/:id/upload-avatar
 */
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

      // Poista vanha
      removeFile(user.profilePicture);

      // Tallenna uusi
      user.profilePicture = req.file.path;
      await user.save();

      res.json(user);
    } catch (err) {
      console.error("upload-avatar error:", err);
      res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

/**
 * Bulk‐lisäkuvien lataus
 * Client kutsuu uploadPhotos() → POST /api/users/:id/upload-photos
 */
router.post(
  "/:id/upload-photos",
  authenticateToken,
  upload.array("photos", 20),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (req.userId !== id)
        return res.status(403).json({ error: "Forbidden" });

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Poistetaan vanhat
      (user.extraImages || []).forEach(removeFile);

      // Tallennetaan uudet
      user.extraImages = req.files.map(f => f.path);
      const saved = await user.save();
      res.json({ extraImages: saved.extraImages });
    } catch (err) {
      console.error("upload-photos error:", err);
      res.status(500).json({ error: "Bulk upload failed" });
    }
  }
);

/**
 * Yksi kuva + slot + crop + caption
 * Client kutsuu uploadPhotoStep() → POST /api/users/:id/upload-photo-step
 */
router.post(
  "/:id/upload-photo-step",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (req.userId !== id)
        return res.status(403).json({ error: "Forbidden" });

      const slot = parseInt(req.body.slot, 10);
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Poistetaan aiempi tiedosto slotista
      if (user.extraImages && user.extraImages[slot]) {
        removeFile(user.extraImages[slot]);
      }
      user.extraImages = user.extraImages || [];
      user.extraImages[slot] = req.file.path;

      const saved = await user.save();
      res.json({ extraImages: saved.extraImages });
    } catch (err) {
      console.error("upload-photo-step error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/**
 * Slot‐kohtainen poisto
 * Client kutsuu deletePhotoSlot() → DELETE /api/users/:id/photos/:slot
 */
router.delete(
  "/:id/photos/:slot",
  authenticateToken,
  async (req, res) => {
    try {
      const { id, slot } = req.params;
      if (req.userId !== id)
        return res.status(403).json({ error: "Forbidden" });

      const idx = parseInt(slot, 10);
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.extraImages && user.extraImages[idx]) {
        removeFile(user.extraImages[idx]);
        user.extraImages[idx] = null;
      }

      const saved = await user.save();
      res.json({ extraImages: saved.extraImages });
    } catch (err) {
      console.error("delete-photo-slot error:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  }
);

module.exports = router;
