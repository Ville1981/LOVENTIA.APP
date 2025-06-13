// server/routes/imageRoutes.js

const express = require("express");
const router = express.Router();

const Subscription = require("../models/Subscription");
const Image = require("../models/Image");
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");
const { profileUpload } = require("../config/multer");

/**
 * 1) POST /api/users/:userId/upload-avatar
 */
router.post(
  "/:userId/upload-avatar",
  authenticateToken,
  profileUpload.single("profilePhoto"),
  async (req, res) => {
    try {
      // Käyttäjä voi päivittää vain oman avattarinsa
      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      // Tarkista, että tiedosto on mukana
      if (!req.file)
        return res.status(400).json({ error: "No file uploaded" });

      // Yksi avatar sallittu
      const currentAvatars = await Image.countDocuments({
        owner: req.userId,
        isAvatar: true,
      });
      if (currentAvatars >= 1)
        return res
          .status(403)
          .json({ error: "Avatar limit reached (1 avatar allowed)" });

      // Luo ja tallenna uusi avatar
      const img = await Image.create({
        owner: req.userId,
        url: `/uploads/profiles/${req.file.filename}`,
        uploaded: new Date(),
        isAvatar: true,
      });

      // Päivitä User-profiili
      const user = await User.findById(req.userId);
      user.profilePicture = img.url;
      await user.save();

      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload avatar error:", err);
      return res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

/**
 * 2) POST /api/users/:userId/upload-photos
 */
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  profileUpload.array("photos", 20),
  async (req, res) => {
    try {
      // Käyttäjä voi lisätä kuvia vain omaan profiiliinsa
      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      // Tilaus ja kuvarajat
      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxImages = plan === "premium" ? 20 : 6;

      // Kuinka monta kuvaa jo olemassa
      const existingCount = await Image.countDocuments({
        owner: req.userId,
        isAvatar: false,
      });
      const incoming = req.files.length;
      if (existingCount + incoming > maxImages)
        return res.status(403).json({
          error: `Upload limit exceeded (${maxImages} images allowed for ${plan} plan)`,
        });

      // Tallenna jokainen kuva ja kerää URLit
      const urls = [];
      for (const file of req.files) {
        const img = await Image.create({
          owner: req.userId,
          url: `/uploads/profiles/${file.filename}`,
          uploaded: new Date(),
          isAvatar: false,
        });
        urls.push(img.url);
      }

      // Lisää käyttäjän extraImages-taulukkoon
      const user = await User.findById(req.userId);
      user.extraImages = (user.extraImages || []).concat(urls);
      await user.save();

      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload photos error:", err);
      return res.status(500).json({ error: "Photos upload failed" });
    }
  }
);

module.exports = router;
