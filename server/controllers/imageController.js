// --- REPLACE START: ESM controller with robust model interop + normalized auth + uploads path helpers ---
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Model interop (works whether models export default or module.exports) ---
import * as ImageModule from '../../models/Image.js';
const Image = ImageModule.default || ImageModule;

import * as UserModule from '../../models/User.js';
const User = UserModule.default || UserModule;

/**
 * Controllers for handling avatar and extra image uploads, cropping, and deletions.
 * NOTE:
 *  - Authorization uses normalized req.user.userId (with fallback to legacy req.userId).
 *  - URLs:      /uploads/...
 *  - Disk path: <projectRoot>/uploads/...
 */

// Slots policy (kept explicit; aligned with the rest of backend)
const FREE_SLOTS = 6;
const PREMIUM_SLOTS = 20;

// Helpers ──────────────────────────────────────────────────────────────────────
function getReqUserId(req) {
  return req?.user?.userId || req?.userId || null;
}

function isSameUser(req, userIdFromParams) {
  const uid = getReqUserId(req);
  return uid && String(uid) === String(userIdFromParams);
}

/** Convert a public URL like '/uploads/extra/xyz.jpg' to an absolute disk path */
function urlToDiskPath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const clean = publicUrl.replace(/^\//, ''); // strip leading slash
  // uploads live at project root (same as multer destination in routes)
  return path.resolve(process.cwd(), clean);
}

/** Safe unlink (ignore ENOENT) */
function unlinkSafe(absPath) {
  if (!absPath) return;
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('[imageController] unlinkSafe warning:', err?.message || err);
    }
  }
}

/** Ensure extra images array length is exactly maxSlots (pad with nulls) */
function padToSlots(arr, maxSlots) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < maxSlots) out.push(null);
  if (out.length > maxSlots) out.length = maxSlots;
  return out;
}

/** Pick first empty slot; returns -1 if full */
function firstEmptyIndex(arr) {
  if (!Array.isArray(arr)) return -1;
  return arr.findIndex((x) => !x);
}

// Controllers ─────────────────────────────────────────────────────────────────

/**
 * Replace existing avatar image.
 */
export const uploadAvatar = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isSameUser(req, userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Remove old avatar files & records
    const oldAvatars = await Image.find({ owner: userId, isAvatar: true });
    await Promise.all(
      oldAvatars.map(async (old) => {
        const fileOnDisk = urlToDiskPath(old.url);
        unlinkSafe(fileOnDisk);
        await Image.deleteOne({ _id: old._id });
      })
    );

    // Save new avatar record
    const avatarUrl = `/uploads/profiles/${req.file.filename}`;
    await Image.create({
      owner: userId,
      url: avatarUrl,
      uploaded: new Date(),
      isAvatar: true,
    });

    // Update user's profilePicture
    const user = await User.findById(userId);
    if (user) {
      user.profilePicture = avatarUrl;
      await user.save();
    }

    return res.status(200).json({ profilePicture: avatarUrl });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    return res.status(500).json({ error: 'Avatar upload failed' });
  }
};

/**
 * Bulk upload extra images.
 */
export const uploadPhotos = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isSameUser(req, userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const maxSlots = user.isPremium ? PREMIUM_SLOTS : FREE_SLOTS;
    const existing = Array.isArray(user.extraImages) ? [...user.extraImages] : [];
    const files = req.files || [];

    const used = existing.filter(Boolean).length;
    if (used + files.length > maxSlots) {
      return res
        .status(400)
        .json({ error: `Max ${maxSlots} extra images allowed` });
    }

    const updated = padToSlots(existing, maxSlots);

    for (const file of files) {
      const url = `/uploads/extra/${file.filename}`;
      const idx = firstEmptyIndex(updated);
      if (idx === -1) break;
      updated[idx] = url;
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
    console.error('uploadPhotos error:', err);
    return res.status(500).json({ error: 'Photos upload failed' });
  }
};

/**
 * Single image upload with crop and optional caption.
 */
export const uploadPhotoStep = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isSameUser(req, userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const maxSlots = user.isPremium ? PREMIUM_SLOTS : FREE_SLOTS;
    const arr = padToSlots(user.extraImages, maxSlots);

    // GIF bypass (no crop)
    if (req.file.mimetype === 'image/gif') {
      const gifUrl = `/uploads/extra/${req.file.filename}`;
      const idxGif =
        Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
          ? +slot
          : firstEmptyIndex(arr);
      if (idxGif !== -1) arr[idxGif] = gifUrl;

      await Image.create({
        owner: userId,
        url: gifUrl,
        uploaded: new Date(),
        isAvatar: false,
        caption,
      });

      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ extraImages: arr });
    }

    // Crop non-GIF images
    const uploadsExtraDir = path.resolve(process.cwd(), 'uploads', 'extra');
    const inPath = path.join(uploadsExtraDir, req.file.filename);
    const outName = `crop_${Date.now()}_${req.file.filename}`;
    const outPath = path.join(uploadsExtraDir, outName);

    const left = Math.max(0, +cropX || 0);
    const top = Math.max(0, +cropY || 0);
    const width = Math.max(1, +cropWidth || 1);
    const height = Math.max(1, +cropHeight || 1);

    await sharp(inPath).extract({ left, top, width, height }).toFile(outPath);
    // remove temp (original) file; keep only cropped
    unlinkSafe(inPath);

    const url = `/uploads/extra/${outName}`;
    const idxCrop =
      Number.isInteger(+slot) && +slot >= 0 && +slot < maxSlots
        ? +slot
        : firstEmptyIndex(arr);
    if (idxCrop !== -1) arr[idxCrop] = url;

    await Image.create({
      owner: userId,
      url,
      uploaded: new Date(),
      isAvatar: false,
      caption,
    });

    user.extraImages = arr;
    await user.save();
    return res.status(200).json({ extraImages: arr });
  } catch (err) {
    console.error('uploadPhotoStep error:', err);
    return res.status(500).json({ error: 'Step upload failed' });
  }
};

/**
 * Delete an image in a specified slot (0 = avatar, 1… = extra).
 */
export const deletePhotoSlot = async (req, res) => {
  try {
    const { userId, slot } = req.params;
    if (!isSameUser(req, userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const idx = parseInt(slot, 10);
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Avatar removal (slot 0)
    if (idx === 0) {
      const avatars = await Image.find({ owner: userId, isAvatar: true });
      // remove files on disk
      avatars.forEach((old) => unlinkSafe(urlToDiskPath(old.url)));
      await Image.deleteMany({ owner: userId, isAvatar: true });

      user.profilePicture = null;
      await user.save();
      return res.status(200).json({ profilePicture: null });
    }

    // Extra slot deletion
    const maxSlots = user.isPremium ? PREMIUM_SLOTS : FREE_SLOTS;
    const arr = padToSlots(user.extraImages, maxSlots);

    if (Number.isNaN(idx) || idx < 0 || idx >= arr.length) {
      return res.status(400).json({ error: 'Invalid slot index' });
    }

    const imageUrl = arr[idx];
    if (imageUrl) {
      unlinkSafe(urlToDiskPath(imageUrl));
      await Image.deleteOne({ owner: userId, url: imageUrl });
    }

    arr[idx] = null;
    user.extraImages = arr;
    await user.save();
    return res.status(200).json({ extraImages: arr });
  } catch (err) {
    console.error('deletePhotoSlot error:', err);
    return res.status(500).json({ error: 'Failed to delete photo slot' });
  }
};
// --- REPLACE END ---
