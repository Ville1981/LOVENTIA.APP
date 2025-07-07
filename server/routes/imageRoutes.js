// src/routes/imageRoutes.js
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
 * Korvaa olemassa olevan avatar-kuvan.
 * Vastaa { profilePicture: string }
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

      // Poistetaan vanhat avatar-tietueet ja kuvat
      const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
      await Promise.all(
        oldAvatars.map(async (old) => {
          const fileOnDisk = path.join(__dirname, "..", old.url.replace(/^\//, ""));
          if (fs.existsSync(fileOnDisk)) fs.unlinkSync(fileOnDisk);
          await old.deleteOne();
        })
      );

      // Tallennetaan uusi avatar
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;
      await Image.create({
        owner: userId,
        url: avatarUrl,
        uploaded: new Date(),
        isAvatar: true,
      });

      // Päivitetään käyttäjän profiilikuva-kenttä
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
 * Bulk-lataa lisäkuvat (max 6 tai 20 premiumille).
 * Vastaa { extraImages: string[] }
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
      const existing = Array.isArray(user.extraImages) ? [...user.extraImages] : [];
      const files = req.files || [];

      if (existing.filter(Boolean).length + files.length > maxSlots) {
        return res.status(400).json({
          error: `Max ${maxSlots} extra images allowed`,
        });
      }

      // Täytetään null-slotit ja sijoitetaan kuvat peräkkäin
      const updated = Array.from({ length: maxSlots }, (_, i) => existing[i] || null);
      files.forEach((file) => {
        const url = `/uploads/extra/${file.filename}`;
        const idx = updated.findIndex((img) => !img);
        if (idx !== -1) updated[idx] = url;
        Image.create({
          owner: userId,
          url,
          uploaded: new Date(),
          isAvatar: false,
        });
      });

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
 * Yksittäisen kuvan lataus crop+slot+caption.
 * Vastaa { extraImages: string[] }
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
      // Luo taulukko null-paikoilla jos puuttuu
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      // Cropataan ja tallennetaan uusi tiedosto
      const input = path.join(__dirname, "..", "uploads", "extra", req.file.filename);
      const outputName = `crop_${Date.now()}_${req.file.filename}`;
      const output = path.join(__dirname, "..", "uploads", "extra", outputName);

      await sharp(input)
        .extract({
          left: parseInt(cropX, 10),
          top: parseInt(cropY, 10),
          width: parseInt(cropWidth, 10),
          height: parseInt(cropHeight, 10),
        })
        .toFile(output);
      fs.unlinkSync(input);

      const url = `/uploads/extra/${outputName}`;
      Image.create({
        owner: userId,
        url,
        uploaded: new Date(),
        isAvatar: false,
        caption,
      });

      // Sijoitetaan kuv URL slot-osion mukaisesti
      const idx = Number.isInteger(+slot) && slot >= 0 && slot < maxSlots
        ? +slot
        : arr.findIndex((i) => !i);
      if (idx !== -1) arr[idx] = url;

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
 * Poistaa slotissa olevan kuvan ja palauttaa { extraImages: string[] }
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
      if (arr[idx]) {
        const filePath = path.join(__dirname, "..", arr[idx].replace(/^\//, ""));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
