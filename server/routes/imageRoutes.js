// server/routes/imageRoutes.js

const express = require("express");
const router = express.Router();

const Subscription = require("../models/Subscription");
const Image = require("../models/Image");
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");
const { profileUpload } = require("../config/multer");

/**
 * POST /api/users/:userId/upload-avatar
 * Lataa profiilikuva, rajoitukset tilausplanin mukaan
 */
router.post(
  "/:userId/upload-avatar",
  authenticateToken,
  profileUpload.single("file"),
  async (req, res) => {
    try {
      if (req.userId !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxImages = plan === "premium" ? 20 : 3;

      const currentCount = await Image.countDocuments({ owner: req.userId });
      if (currentCount >= maxImages) {
        return res.status(403).json({ error: `Upload limit reached (${maxImages} images for ${plan} plan)` });
      }

      // Luo Image-dokumentti profiilikuvalla
      const img = await Image.create({
        owner: req.userId,
        url: `/uploads/profiles/${req.file.filename}`,
        uploaded: new Date(),
        isAvatar: true
      });

      // Päivitä User.extraImages ja profilePicture
      const user = await User.findById(req.userId);
      user.profilePicture = img.url;
      // Sisällytä myös extraImages-listaan, jos haluat
      await user.save();

      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload avatar error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/upload-photos
 * Lataa lisäkuvia, rajoitukset tilausplanin mukaan
 */
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  profileUpload.array("photos", 20),
  async (req, res) => {
    try {
      if (req.userId !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxImages = plan === "premium" ? 20 : 6;

      const existingCount = await Image.countDocuments({ owner: req.userId, isAvatar: false });
      const incomingCount = req.files.length;
      if (existingCount + incomingCount > maxImages) {
        return res.status(403).json({ error: `Upload limit exceeded (${maxImages} images for ${plan} plan)` });
      }

      // Luo Image-dokumentit
      const urls = [];
      for (const file of req.files) {
        const img = await Image.create({
          owner: req.userId,
          url: `/uploads/profiles/${file.filename}`,
          uploaded: new Date(),
          isAvatar: false
        });
        urls.push(img.url);
      }

      // Päivitä käyttäjän extraImages-kenttä
      const user = await User.findById(req.userId);
      user.extraImages = (user.extraImages || []).concat(urls);
      await user.save();

      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload photos error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }
);

module.exports = router;
