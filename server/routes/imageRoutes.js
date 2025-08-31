// PATH: server/routes/imageRoutes.js

// --- REPLACE START: ESM imports & CJS interop (User/Image) + shared normalizers ---
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

// Auth + upload middlewares (ESM)
import authenticate from '../middleware/authenticate.js';
import { upload } from '../config/multer.js';

// Models (interop both ESM default and CJS module.exports)
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

import * as ImageModule from '../models/Image.js';
const Image = ImageModule.default || ImageModule;

/**
 * Normalization helpers – keep identical logic/intent to user.js & controllers:
 * - toWebPathStrict ensures forward slashes and leading '/'
 * - normalizeUserOut mirrors photos/extraImages and normalizes avatar path
 */
function toWebPathStrict(p) {
  if (!p) return '';
  const s = String(p).replace(/\\/g, '/').replace(/^\/?/, '');
  return `/${s}`;
}

function normalizeUserOut(u) {
  if (!u) return u;
  const plain = typeof u.toObject === 'function' ? u.toObject() : { ...u };

  const photosIn = Array.isArray(plain.photos) ? plain.photos : null;
  const extraIn  = Array.isArray(plain.extraImages) ? plain.extraImages : null;

  let canonical = photosIn || extraIn || [];
  if (photosIn && extraIn && extraIn.length > photosIn.length) canonical = extraIn;

  const normalizedList = (canonical || []).filter(Boolean).map(toWebPathStrict);
  plain.photos = normalizedList;
  plain.extraImages = normalizedList;

  if (plain.profilePicture) plain.profilePicture = toWebPathStrict(plain.profilePicture);
  if (plain.profilePhoto)   plain.profilePhoto   = toWebPathStrict(plain.profilePhoto);

  return plain;
}
// --- REPLACE END ---

const router = express.Router();

// Pre-flight OPTIONS for multipart wizard step
router.options(
  '/:userId/photos/upload-photo-step',
  (_req, res) => res.sendStatus(200)
);

/**
 * POST /api/users/:userId/upload-avatar
 * - Replaces previous avatar, deletes files/records
 * - Responds with { user: <normalized user> } for consistency with /api/users stack
 */
router.post(
  '/:userId/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!req?.user?.id || req.user.id !== String(userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Remove old avatars (db + fs) – best-effort
      const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
      await Promise.all(
        oldAvatars.map(async (old) => {
          const fileOnDisk = path.join(process.cwd(), String(old.url || '').replace(/^\//, ''));
          await fs.unlink(fileOnDisk).catch((e) => {
            if (e?.code !== 'ENOENT') console.warn('[avatar] delete warning:', e?.message || e);
          });
          await Image.deleteOne({ _id: old._id }).catch(() => {});
        })
      );

      // Save new avatar record
      const avatarUrl = toWebPathStrict(req.file.path || `/uploads/avatars/${req.file.filename}`);
      await Image.create({
        owner: userId,
        url: avatarUrl,
        uploaded: new Date(),
        isAvatar: true
      });

      // Update user doc
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.profilePicture = avatarUrl;
      await user.save();

      // ✅ Unified response
      return res.status(200).json({ user: normalizeUserOut(user) });
    } catch (err) {
      console.error('Upload avatar error:', err);
      return res.status(500).json({ error: 'Avatar upload failed' });
    }
  }
);

/**
 * POST /api/users/:userId/photos
 * - Bulk append to extraImages with maxSlots by tier
 * - Creates Image docs for each
 * - Responds with { user: <normalized user> } (unifies with user.js)
 */
router.post(
  '/:userId/photos',
  authenticate,
  upload.array('photos', 20),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!req?.user?.id || req.user.id !== String(userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const existing = Array.isArray(user.extraImages) ? [...user.extraImages] : [];
      const files = Array.isArray(req.files) ? req.files : [];

      if (existing.filter(Boolean).length + files.length > maxSlots) {
        return res.status(400).json({ error: `Max ${maxSlots} extra images allowed` });
      }

      // Prepare slots array up to maxSlots (preserve existing order)
      const updated = Array.from({ length: maxSlots }, (_, i) => existing[i] || null);

      for (const file of files) {
        const url = toWebPathStrict(file.path || `/uploads/extra/${file.filename}`);
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

      // ✅ Unified response
      return res.status(200).json({ user: normalizeUserOut(user) });
    } catch (err) {
      console.error('Bulk upload error:', err);
      return res.status(500).json({ error: 'Photos upload failed' });
    }
  }
);

/**
 * POST /api/users/:userId/photos/upload-photo-step
 * - One-by-one slot upload with optional crop
 * - Responds with { user: <normalized user> }
 */
router.post(
  '/:userId/photos/upload-photo-step',
  authenticate,
  upload.single('photo'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!req?.user?.id || req.user.id !== String(userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const maxSlots = user.isPremium ? 50 : 9;
      const arr = Array.isArray(user.extraImages)
        ? [...user.extraImages]
        : Array(maxSlots).fill(null);

      // If GIF → bypass crop
      if (req.file.mimetype === 'image/gif') {
        const gifUrl = toWebPathStrict(req.file.path || `/uploads/extra/${req.file.filename}`);
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
        return res.status(200).json({ user: normalizeUserOut(user) });
      }

      // Input/output file paths
      const inPath  = path.join(process.cwd(), String(req.file.path || '').replace(/^\//, ''));
      const outName = `crop_${Date.now()}_${req.file.filename}`;
      const outPath = path.join(process.cwd(), 'uploads', 'extra', outName);

      // --- REPLACE START: bypass Sharp if no valid crop dims (consistent with controller) ---
      const hasCrop = cropWidth && cropHeight;
      if (!hasCrop || +cropWidth === 0 || +cropHeight === 0) {
        await fs.rename(inPath, outPath);
      } else {
        const left   = parseInt(cropX, 10) || 0;
        const top    = parseInt(cropY, 10) || 0;
        const width  = parseInt(cropWidth, 10);
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
            return res.status(500).json({ error: 'Failed to crop image', details: e.message });
          }
        }
      }
      // --- REPLACE END ---

      // Clean up if both exist
      const inExists = await fs.stat(inPath).then(() => true).catch(() => false);
      const outExists = await fs.stat(outPath).then(() => true).catch(() => false);
      if (inExists && outExists) {
        await fs.unlink(inPath).catch(() => {});
      }

      // Assign URL & save
      const url = toWebPathStrict(path.join('uploads', 'extra', outName));
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

      // ✅ Unified response
      return res.status(200).json({ user: normalizeUserOut(user) });
    } catch (err) {
      console.error('Step upload error:', err);
      return res.status(500).json({ error: 'Step upload failed' });
    }
  }
);

/**
 * DELETE /api/users/:userId/photos/:slot
 * - Clears a slot and deletes backing file + Image doc if present
 * - Responds with { user: <normalized user> }
 */
router.delete(
  '/:userId/photos/:slot',
  authenticate,
  async (req, res) => {
    try {
      const { userId, slot } = req.params;
      if (!req?.user?.id || req.user.id !== String(userId)) {
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

      if (!Number.isInteger(idx) || idx < 0 || idx >= maxSlots) {
        return res.status(400).json({ error: 'Invalid slot index' });
      }

      const imageUrl = arr[idx];
      if (imageUrl) {
        const filePath = path.join(process.cwd(), String(imageUrl).replace(/^\//, ''));
        await fs.unlink(filePath).catch(() => {});
        await Image.deleteOne({ owner: userId, url: imageUrl }).catch(() => {});
      }

      arr[idx] = null;
      user.extraImages = arr;
      await user.save();

      // ✅ Unified response
      return res.status(200).json({ user: normalizeUserOut(user) });
    } catch (err) {
      console.error('Delete slot error:', err);
      return res.status(500).json({ error: 'Failed to delete photo slot' });
    }
  }
);

export default router;
