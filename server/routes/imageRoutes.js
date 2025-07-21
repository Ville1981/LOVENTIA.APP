// server/routes/imageRoutes.js

const express = require("express");
const router  = express.Router();

const path              = require("path");
const fs                = require("fs").promises;
const sharp             = require("sharp");
const authenticateToken = require("../middleware/auth");
const { upload }        = require("../config/multer");
const Image             = require("../models/Image");
const User              = require("../models/User");

// ——— PRE-FLIGHT (OPTIONS) — ensure it’s registered first ———
router.options("/:userId/photos/upload-photo-step", (req, res) => res.sendStatus(200));
// ————————————————————————————————————————————————————————

/**
 * POST /api/users/:userId/upload-avatar
 */
router.post(
  "/:userId/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Remove old avatars
      const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
      await Promise.all(
        oldAvatars.map(async (old) => {
          const fileOnDisk = path.join(__dirname, "..", old.url.replace(/^\//, ""));
          try { await fs.unlink(fileOnDisk); } catch (err) {
            if (err.code !== "ENOENT") console.warn("Could not delete old avatar:", err);
          }
          await Image.deleteOne({ _id: old._id });
        })
      );

      // Save new avatar
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;
      await Image.create({ owner: userId, url: avatarUrl, uploaded: new Date(), isAvatar: true });

      // Update user record
      const user = await User.findById(userId);
      user.profilePicture = avatarUrl;
      await user.save();

      return res.status(200).json({ profilePicture: avatarUrl });
    } catch (err) {
      console.error("Upload avatar error:", err);
      return res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/photos
 */
router.post(
  "/:userId/photos",
  authenticateToken,
  upload.array("photos"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const existing = Array.isArray(user.extraImages) ? [...user.extraImages] : [];
      const files = req.files || [];

      if (existing.filter(Boolean).length + files.length > maxSlots) {
        return res.status(400).json({ error: `Max ${maxSlots} extra images allowed` });
      }

      const updated = Array.from({ length: maxSlots }, (_, i) => existing[i] || null);
      for (const file of files) {
        const url = `/uploads/extra/${file.filename}`;
        const idx = updated.findIndex((img) => !img);
        if (idx === -1) break;
        updated[idx] = url;
        await Image.create({ owner: userId, url, uploaded: new Date(), isAvatar: false });
      }

      user.extraImages = updated;
      await user.save();
      return res.status(200).json({ extraImages: updated });
    } catch (err) {
      console.error("Bulk upload error:", err);
      return res.status(500).json({ error: "Photos upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/photos/upload-photo-step
 */
router.post(
  "/:userId/photos/upload-photo-step",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      // GIF bypass
      if (req.file.mimetype === "image/gif") {
        const gifUrl = `/uploads/extra/${req.file.filename}`;
        const idxGif =
          Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
            ? +slot
            : arr.findIndex((i) => !i);
        if (idxGif !== -1) arr[idxGif] = gifUrl;

        await Image.create({ owner: userId, url: gifUrl, uploaded: new Date(), isAvatar: false, caption });
        user.extraImages = arr;
        await user.save();
        return res.status(200).json({ extraImages: arr });
      }

      // Crop via Sharp
      const inPath  = path.join(__dirname, "..", "uploads", "extra", req.file.filename);
      const outName = `crop_${Date.now()}_${req.file.filename}`;
      const outPath = path.join(__dirname, "..", "uploads", "extra", outName);

      await sharp(inPath)
        .extract({ left: +cropX, top: +cropY, width: +cropWidth, height: +cropHeight })
        .toFile(outPath);
      await fs.unlink(inPath).catch(() => {});

      const url = `/uploads/extra/${outName}`;
      const idxCrop =
        Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
          ? +slot
          : arr.findIndex((i) => !i);
      if (idxCrop !== -1) arr[idxCrop] = url;

      await Image.create({ owner: userId, url, uploaded: new Date(), isAvatar: false, caption });
      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ extraImages: arr });
    } catch (err) {
      console.error("Step upload error:", err);
      return res.status(500).json({ error: "Step upload failed" });
    }
  }
);

/**
 * DELETE /api/users/:userId/photos/:slot
 */
router.delete(
  "/:userId/photos/:slot",
  authenticateToken,
  async (req, res) => {
    try {
      const { userId, slot } = req.params;
      if (req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const idx = parseInt(slot, 10);
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      if (idx < 0 || idx >= maxSlots) {
        return res.status(400).json({ error: "Invalid slot index" });
      }

      const imageUrl = arr[idx];
      if (imageUrl) {
        const filePath = path.join(__dirname, "..", imageUrl.replace(/^\//, ""));
        await fs.unlink(filePath).catch(() => {});
        await Image.deleteOne({ owner: userId, url: imageUrl });
      }

      arr[idx] = null;
      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ extraImages: arr });
    } catch (err) {
      console.error("Delete slot error:", err);
      return res.status(500).json({ error: "Failed to delete photo slot" });
    }
  }
);

module.exports = router;
