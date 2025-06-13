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
      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxAvatar = 1; // aina 1 profiilikuva
      const currentAvatars = await Image.countDocuments({
        owner: req.userId,
        isAvatar: true,
      });
      if (currentAvatars >= maxAvatar)
        return res
          .status(403)
          .json({ error: `Avatar limit reached (${maxAvatar})` });

      const img = await Image.create({
        owner: req.userId,
        url: `/uploads/profiles/${req.file.filename}`,
        uploaded: new Date(),
        isAvatar: true,
      });

      const user = await User.findById(req.userId);
      user.profilePicture = img.url;
      await user.save();

      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload avatar error:", err);
      return res.status(500).json({ error: "Upload failed" });
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
      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxImages = plan === "premium" ? 20 : 6;
      const existingCount = await Image.countDocuments({
        owner: req.userId,
        isAvatar: false,
      });
      const incoming = req.files.length;
      if (existingCount + incoming > maxImages)
        return res.status(403).json({
          error: `Upload limit exceeded (${maxImages} images for ${plan} plan)`,
        });

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
