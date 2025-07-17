const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const Image = require("../models/Image");
const User = require("../models/User");
const authenticateToken = require("../middleware/auth");
const { upload } = require("../config/multer");

/**
 * POST /api/users/:userId/upload-avatar
 * Replace existing avatar image.
 * Response: { profilePicture: string }
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

      // Remove old avatar records and files (async unlink)
      const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
      await Promise.all(
        oldAvatars.map(async (old) => {
          const fileOnDisk = path.join(
            __dirname,
            "..",
            old.url.replace(/^\//, "")
          );
          fs.unlink(fileOnDisk, (err) => {
            if (err && err.code !== "ENOENT") {
              console.warn("Could not delete old avatar:", err.code, fileOnDisk);
            }
          });
          await Image.deleteOne({ _id: old._id });
        })
      );

      // Save new avatar
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;
      await Image.create({
        owner: userId,
        url: avatarUrl,
        uploaded: new Date(),
        isAvatar: true,
      });

      // Update user's profilePicture field
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
 * POST /api/users/:userId/upload-photos
 * Bulk upload extra images (max 6 or 20 for premium).
 * Response: { extraImages: string[] }
 */
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  upload.array("photos", 20),
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

      const maxSlots = user.isPremium ? 20 : 6;
      const existing = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : [];
      const files = req.files || [];

      if (existing.filter(Boolean).length + files.length > maxSlots) {
        return res.status(400).json({
          error: `Max ${maxSlots} extra images allowed`,
        });
      }

      const updated = Array.from({ length: maxSlots }, (_, i) => existing[i] || null);
      for (const file of files) {
        const url = `/uploads/extra/${file.filename}`;
        const idx = updated.findIndex((img) => !img);
        if (idx !== -1) updated[idx] = url;
        await Image.create({
          owner: userId,
          url,
          uploaded: new Date(),
          isAvatar: false,
        });
      }

      user.extraImages = updated;
      await user.save();

      return res.status(200).json({ extraImages: updated });
    } catch (err) {
      console.error("Upload photos error:", err);
      return res.status(500).json({ error: "Photos upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/upload-photo-step
 * Single image upload with optional crop, slot, and caption.
 * Skips cropping for GIFs and stores them directly.
 * Response: { extraImages: string[] }
 */
router.post(
  "/:userId/upload-photo-step",
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

      const maxSlots = user.isPremium ? 20 : 6;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      // GIF: skip crop, store directly
      if (req.file.mimetype === "image/gif") {
        const gifUrl = `/uploads/extra/${req.file.filename}`;
        await Image.create({
          owner: userId,
          url: gifUrl,
          uploaded: new Date(),
          isAvatar: false,
          caption,
        });
        const idxGif = Number.isInteger(+slot) && slot >= 0 && slot < maxSlots
          ? +slot
          : arr.findIndex((i) => !i);
        if (idxGif !== -1) arr[idxGif] = gifUrl;

        user.extraImages = arr;
        await user.save();
        return res.status(200).json({ extraImages: arr });
      }

      // Other images: crop with Sharp
      const inputPath = path.join(
        __dirname,
        "..",
        "uploads",
        "extra",
        req.file.filename
      );
      const outputName = `crop_${Date.now()}_${req.file.filename}`;
      const outputPath = path.join(
        __dirname,
        "..",
        "uploads",
        "extra",
        outputName
      );

      await sharp(inputPath)
        .extract({
          left: parseInt(cropX, 10),
          top: parseInt(cropY, 10),
          width: parseInt(cropWidth, 10),
          height: parseInt(cropHeight, 10),
        })
        .toFile(outputPath);

      fs.unlink(inputPath, (err) => {
        if (err && err.code !== "ENOENT") {
          console.warn("Could not delete temp upload:", err.code, inputPath);
        }
      });

      const url = `/uploads/extra/${outputName}`;
      await Image.create({
        owner: userId,
        url,
        uploaded: new Date(),
        isAvatar: false,
        caption,
      });

      const idxCrop = Number.isInteger(+slot) && slot >= 0 && slot < maxSlots
        ? +slot
        : arr.findIndex((i) => !i);
      if (idxCrop !== -1) arr[idxCrop] = url;

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
 * Deletes the image in the specified slot and its record.
 * Response: { extraImages: string[] }
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

      const maxSlots = user.isPremium ? 20 : 6;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      if (idx < 0 || idx >= arr.length) {
        return res.status(400).json({ error: "Invalid slot index" });
      }

      const imageUrl = arr[idx];
      if (imageUrl) {
        const filePath = path.join(
          __dirname,
          "..",
          imageUrl.replace(/^\//, "")
        );
        fs.unlink(filePath, (err) => {
          if (err && err.code !== "ENOENT") {
            console.warn("Could not delete slot image:", err.code, filePath);
          }
        });
        await Image.deleteOne({ owner: userId, url: imageUrl });
      }

      arr[idx] = null;
      user.extraImages = arr;
      await user.save();

      return res.status(200).json({ extraImages: arr });
    } catch (err) {
      console.error("Delete photo slot error:", err);
      return res.status(500).json({ error: "Failed to delete photo slot" });
    }
  }
);

module.exports = router;
