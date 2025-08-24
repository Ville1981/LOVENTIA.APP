// server/routes/imageRoutes.js

// --- REPLACE START: ESM imports & CJS interop (User/Image), keep existing behavior ---
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

// Auth + upload middlewares (ESM)
import authenticate from '../middleware/authenticate.js';
import { upload } from '../config/multer.js';

// Models
// Interop for CommonJS-exported User (works whether it exports default or module.exports)
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

// Interop for Image model as well (avoids the same default import crash if it's CommonJS)
import * as ImageModule from '../models/Image.js';
const Image = ImageModule.default || ImageModule;
// --- REPLACE END ---

const router = express.Router();

// Pre-flight OPTIONS for multipart wizard step
router.options(
  '/:userId/photos/upload-photo-step',
  (_req, res) => res.sendStatus(200)
);

/**
 * POST /api/users/:userId/upload-avatar
 */
router.post(
  '/:userId/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Remove old avatars
      const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
      await Promise.all(
        oldAvatars.map(async (old) => {
          const fileOnDisk = path.join(
            process.cwd(),
            old.url.replace(/^\//, '')
          );
          await fs.unlink(fileOnDisk).catch((e) => {
            if (e.code !== 'ENOENT') console.warn('Could not delete:', e);
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
        isAvatar: true
      });

      // Update user document
      const user = await User.findById(userId);
      user.profilePicture = avatarUrl;
      await user.save();

      return res.status(200).json({ profilePicture: avatarUrl });
    } catch (err) {
      console.error('Upload avatar error:', err);
      return res.status(500).json({ error: 'Avatar upload failed' });
    }
  }
);

/**
 * POST /api/users/:userId/photos
 */
router.post(
  '/:userId/photos',
  authenticate,
  upload.array('photos', 20),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const existing = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : [];
      const files = req.files ?? [];

      if (existing.filter(Boolean).length + files.length > maxSlots) {
        return res
          .status(400)
          .json({ error: `Max ${maxSlots} extra images allowed` });
      }

      // Prepare slots
      const updated = Array.from({ length: maxSlots }, (_, i) =>
        existing[i] || null
      );
      for (const file of files) {
        const url = `/uploads/extra/${file.filename}`;
        const idx = updated.findIndex((slot) => !slot);
        if (idx === -1) break;
        updated[idx] = url;
        await Image.create({
          owner: userId,
          url,
          uploaded: new Date(),
          isAvatar: false
        });
      }

      user.extraImages = updated;
      await user.save();
      return res.status(200).json({ extraImages: updated });
    } catch (err) {
      console.error('Bulk upload error:', err);
      return res.status(500).json({ error: 'Photos upload failed' });
    }
  }
);

/**
 * POST /api/users/:userId/photos/upload-photo-step
 */
router.post(
  '/:userId/photos/upload-photo-step',
  authenticate,
  upload.single('photo'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const {
        slot,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        caption
      } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      // GIF bypass
      if (req.file.mimetype === 'image/gif') {
        const gifUrl = `/uploads/extra/${req.file.filename}`;
        const idxGif =
          Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
            ? +slot
            : arr.findIndex((i) => !i);
        if (idxGif !== -1) arr[idxGif] = gifUrl;

        await Image.create({
          owner: userId,
          url: gifUrl,
          uploaded: new Date(),
          isAvatar: false,
          caption
        });
        user.extraImages = arr;
        await user.save();
        return res.status(200).json({ extraImages: arr });
      }

      // File paths
      const inPath = path.join(
        process.cwd(),
        'uploads',
        'extra',
        req.file.filename
      );
      const outName = `crop_${Date.now()}_${req.file.filename}`;
      const outPath = path.join(
        process.cwd(),
        'uploads',
        'extra',
        outName
      );

      // --- REPLACE START: bypass Sharp if no valid crop dims ---
      const hasCrop = cropWidth && cropHeight;
      if (!hasCrop || +cropWidth === 0 || +cropHeight === 0) {
        await fs.rename(inPath, outPath);
      } else {
        const left = parseInt(cropX, 10) || 0;
        const top = parseInt(cropY, 10) || 0;
        const width = parseInt(cropWidth, 10);
        const height = parseInt(cropHeight, 10);

        if (!width || !height) {
          await fs.rename(inPath, outPath);
        } else {
          try {
            await sharp(inPath)
              .extract({ left, top, width, height })
              .toFile(outPath);
            await fs.unlink(inPath).catch(() => {});
          } catch (e) {
            console.error('Error cropping:', e);
            return res
              .status(500)
              .json({ error: 'Failed to crop image', details: e.message });
          }
        }
      }
      // --- REPLACE END ---

      // Clean up if both exist
      const inExists = await fs
        .stat(inPath)
        .then(() => true)
        .catch(() => false);
      const outExists = await fs
        .stat(outPath)
        .then(() => true)
        .catch(() => false);
      if (inExists && outExists) {
        await fs.unlink(inPath).catch(() => {});
      }

      // Assign URL & save
      const url = `/uploads/extra/${outName}`;
      const idxCrop =
        Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
          ? +slot
          : arr.findIndex((i) => !i);
      if (idxCrop !== -1) arr[idxCrop] = url;

      await Image.create({
        owner: userId,
        url,
        uploaded: new Date(),
        isAvatar: false,
        caption
      });
      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ extraImages: arr });
    } catch (err) {
      console.error('Step upload error:', err);
      return res.status(500).json({ error: 'Step upload failed' });
    }
  }
);

/**
 * DELETE /api/users/:userId/photos/:slot
 */
router.delete(
  '/:userId/photos/:slot',
  authenticate,
  async (req, res) => {
    try {
      const { userId, slot } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const idx = parseInt(slot, 10);
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      if (idx < 0 || idx >= maxSlots) {
        return res.status(400).json({ error: 'Invalid slot index' });
      }

      const imageUrl = arr[idx];
      if (imageUrl) {
        const filePath = path.join(
          process.cwd(),
          imageUrl.replace(/^\//, '')
        );
        await fs.unlink(filePath).catch(() => {});
        await Image.deleteOne({ owner: userId, url: imageUrl });
      }

      arr[idx] = null;
      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ extraImages: arr });
    } catch (err) {
      console.error('Delete slot error:', err);
      return res.status(500).json({ error: 'Failed to delete photo slot' });
    }
  }
);

export default router;
