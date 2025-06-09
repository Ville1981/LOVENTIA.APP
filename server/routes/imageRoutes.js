// File: server/routes/imageRoutes.js

const express = require("express");
const router = express.Router();

const Subscription = require("../models/Subscription");
const Image = require("../models/Image");
const authenticateToken = require("../middleware/auth");
const { profileUpload } = require("../config/multer");

// POST /api/users/:userId/upload-avatar
// Lataa profiilikuva, rajoitukset tilausplanin mukaan
router.post(
  "/:userId/upload-avatar",
  authenticateToken,
  profileUpload.single("file"),
  async (req, res) => {
    try {
      // Varmista, että tokenin käyttäjä ja polun userId täsmäävät
      if (req.userId !== req.params.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Hae käyttäjän tilaus
      const sub = await Subscription.findOne({ user: req.userId });
      const plan = sub?.plan || "free";
      const maxImages = plan === "premium" ? 12 : 3;

      // Laske kuinka monta kuvaa käyttäjällä on jo
      const currentCount = await Image.countDocuments({ owner: req.userId });

      if (currentCount >= maxImages) {
        return res
          .status(403)
          .json({ error: `Upload limit reached (${maxImages} images for ${plan} plan)` });
      }

      // Tallenna Image-dokumentti
      const newImage = await Image.create({
        owner: req.userId,
        url: `/uploads/profiles/${req.file.filename}`,
        uploaded: new Date()
      });

      res.status(201).json(newImage);
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

module.exports = router;
