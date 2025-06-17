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
 * - Tallentaa yhden avatar-kuvan käyttäjälle
 * - Rajoitus: 1 avatar-kuva
 */
router.post(
  "/:userId/upload-avatar",
  authenticateToken,
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      console.log(`⛔ Avatar upload: user=${req.userId}, param=${req.params.userId}`);
      console.log("📦 req.file:", req.file);

      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      if (!req.file)
        return res.status(400).json({ error: "No file uploaded" });

      const avatarCount = await Image.countDocuments({ owner: req.userId, isAvatar: true });
      console.log("⛔ avatarCount:", avatarCount);
      if (avatarCount >= 1)
        return res.status(403).json({ error: "Avatar limit reached (1 allowed)" });

      const newAvatar = await Image.create({
        owner: req.userId,
        url: `/uploads/profiles/${req.file.filename}`,
        uploaded: new Date(),
        isAvatar: true,
      });

      const user = await User.findById(req.userId);
      user.profilePicture = newAvatar.url;
      await user.save();

      console.log("✅ Avatar upload success, updated user profilePicture to", newAvatar.url);
      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload avatar error:", err);
      return res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/upload-photos
 * - Tallentaa useita lisäkuvia
 * - Rajoitus: profiilikuvan jälkeen enintään 6 kuvaa (Premium: 20)
 */
router.post(
  "/:userId/upload-photos",
  authenticateToken,
  upload.array("photos", 20),
  async (req, res) => {
    try {
      console.log(`⛔ Photos upload: user=${req.userId}, param=${req.params.userId}`);
      console.log("📦 req.files:", req.files);
      console.log("📦 req.body.slots:", req.body.slots);

      if (req.userId !== req.params.userId)
        return res.status(403).json({ error: "Forbidden" });

      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "Käyttäjää ei löydy." });

      const existingImgs = Array.isArray(user.extraImages) ? [...user.extraImages] : [];
      const existingCount = existingImgs.filter(Boolean).length;
      const incomingCount = req.files.length;
      const maxExtra = user.isPremium ? 20 : 6;

      if (existingCount + incomingCount > maxExtra) {
        return res.status(403).json({
          error: `Lisäkuvien kokonaismäärä ei saa ylittää ${maxExtra} kuvaa (nyt ${existingCount + incomingCount}).`
        });
      }

      // Valmista taulukko, jossa paikka jokaiselle slottiin (null = tyhjä)
      const updatedImgs = Array.from({ length: maxExtra }, (_, i) => existingImgs[i] || null);

      // Slot‐indeksit slot‐parametrista
      let slots = [];
      const raw = req.body.slots;
      if (Array.isArray(raw)) {
        slots = raw.map((s) => parseInt(s, 10));
      } else if (raw !== undefined) {
        slots = [parseInt(raw, 10)];
      }

      // Luodaan Image‐dokumentit ja sijoitetaan URL‐osoitteet taulukkoon
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const newUrl = `/uploads/extra/${file.filename}`;
        await Image.create({
          owner: req.userId,
          url: newUrl,
          uploaded: new Date(),
          isAvatar: false
        });

        // Jos clientsends slot, käytä sitä, muussa tapauksessa etsi ensimmäinen null
        const slotIndex = Number.isInteger(slots[i]) && slots[i] >= 0 && slots[i] < maxExtra
          ? slots[i]
          : updatedImgs.findIndex((src) => !src);

        if (slotIndex !== -1) {
          updatedImgs[slotIndex] = newUrl;
        }
      }

      user.extraImages = updatedImgs;
      await user.save();

      console.log("✅ Photos upload success, updated extraImages:", user.extraImages);
      return res.status(201).json({ user });
    } catch (err) {
      console.error("Upload photos error:", err);
      return res.status(500).json({ error: "Photos upload failed" });
    }
  }
);

/**
 * POST /api/users/:userId/upload-photo-step
 * - Tallentaa yhden kuvan vaiheittain crop, caption ja slot
 */
router.post(
  "/:userId/upload-photo-step",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    try {
      console.log(`⛔ Step upload: user=${req.userId}, param=${req.params.userId}`);
      if (req.userId !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body;
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const maxExtra = user.isPremium ? 20 : 6;
      // Varmista aina taulukon pituus
      user.extraImages = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxExtra).fill(null);
      while (user.extraImages.length < maxExtra) user.extraImages.push(null);

      // Crop & save
      const inputPath = path.join(__dirname, "..", "uploads", "extra", req.file.filename);
      const outputFilename = `crop_${Date.now()}_${req.file.filename}`;
      const outputPath = path.join(__dirname, "..", "uploads", "extra", outputFilename);

      await sharp(inputPath)
        .extract({
          left: parseInt(cropX, 10),
          top: parseInt(cropY, 10),
          width: parseInt(cropWidth, 10),
          height: parseInt(cropHeight, 10),
        })
        .toFile(outputPath);

      fs.unlink(inputPath, (err) => {
        if (err) console.warn("Failed to remove original file", err);
      });

      const newUrl = `/uploads/extra/${outputFilename}`;
      await Image.create({
        owner: req.userId,
        url: newUrl,
        uploaded: new Date(),
        isAvatar: false,
        caption,
      });

      const slotIndex = Number.isInteger(parseInt(slot, 10)) && parseInt(slot, 10) >= 0 && parseInt(slot, 10) < maxExtra
        ? parseInt(slot, 10)
        : user.extraImages.findIndex((src) => !src);

      if (slotIndex !== -1) {
        user.extraImages[slotIndex] = newUrl;
      }

      await user.save();
      console.log(`✅ Step upload success, slot ${slotIndex}, url ${newUrl}`);
      console.log("✅ After step upload, extraImages:", user.extraImages);
      return res.status(201).json({ user });
    } catch (err) {
      console.error("Step upload error:", err);
      return res.status(500).json({ error: "Step upload failed" });
    }
  }
);

/**
 * DELETE /api/users/:userId/photos/:slot
 * - Asettaa käyttäjän extraImages[slot] = null, säilyttää taulukon pituuden
 */
router.delete(
  "/:userId/photos/:slot",
  authenticateToken,
  async (req, res) => {
    try {
      const { userId, slot } = req.params;
      const idx = parseInt(slot, 10);

      if (req.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const max = user.isPremium ? 20 : 6;
      if (!Array.isArray(user.extraImages)) user.extraImages = Array(max).fill(null);
      while (user.extraImages.length < max) user.extraImages.push(null);

      if (idx < 0 || idx >= user.extraImages.length) {
        return res.status(400).json({ error: "Invalid slot index" });
      }

      user.extraImages[idx] = null;
      await user.save();
      console.log(`✅ Deleted slot ${idx}, current extraImages:`, user.extraImages);

      return res.status(200).json({ user });
    } catch (err) {
      console.error("Delete photo slot error:", err);
      return res.status(500).json({ error: "Failed to delete photo slot" });
    }
  }
);

/**
 * Diagnostic endpoint to inspect images stored in DB
 */
router.get(
  "/:userId/images",
  authenticateToken,
  async (req, res) => {
    try {
      if (req.userId !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
      const images = await Image.find({ owner: req.userId });
      console.log(`⛔ Diagnostic fetch: found ${images.length} documents`);
      return res.status(200).json({ images });
    } catch (err) {
      console.error("Fetch images error:", err);
      return res.status(500).json({ error: "Failed to fetch images" });
    }
  }
);

module.exports = router;
