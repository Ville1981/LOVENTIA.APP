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
 * Normalization helpers – shared with user routes:
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

/* -----------------------------------------------------------------------------
 * Handlers (declared once, mounted on multiple route patterns for back-compat)
 * ---------------------------------------------------------------------------- */
async function ensureSelfOr403(req, paramKey = 'userId') {
  const id = String(req.params?.[paramKey] || '');
  if (!req?.user?.id || req.user.id !== id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return id;
}

async function handleUploadAvatar(req, res) {
  try {
    const userId = await ensureSelfOr403(req, 'userId');
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
      isAvatar: true,
    });

    // Update user doc
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.profilePicture = avatarUrl;
    await user.save();

    // Unified response
    return res.status(200).json({ user: normalizeUserOut(user) });
  } catch (err) {
    const code = err?.status || 500;
    console.error('Upload avatar error:', err?.message || err);
    return res.status(code).json({ error: code === 403 ? 'Forbidden' : 'Avatar upload failed' });
  }
}

async function handleBulkPhotos(req, res) {
  try {
    const userId = await ensureSelfOr403(req, 'userId');

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
        isAvatar: false,
      });
    }

    user.extraImages = updated;
    await user.save();

    // Unified response
    return res.status(200).json({ user: normalizeUserOut(user) });
  } catch (err) {
    const code = err?.status || 500;
    console.error('Bulk upload error:', err?.message || err);
    return res.status(code).json({ error: code === 403 ? 'Forbidden' : 'Photos upload failed' });
  }
}

async function handlePhotoStep(req, res) {
  try {
    const userId = await ensureSelfOr403(req, 'userId');
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
        caption,
      });
      user.extraImages = arr;
      await user.save();
      return res.status(200).json({ user: normalizeUserOut(user) });
    }

    // Input/output file paths
    const inPath  = path.join(process.cwd(), String(req.file.path || '').replace(/^\//, ''));
    const outName = `crop_${Date.now()}_${req.file.filename}`;
    const outPath = path.join(process.cwd(), 'uploads', 'extra', outName);

    // Bypass Sharp if no valid crop dims
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
      caption,
    });
    user.extraImages = arr;
    await user.save();

    // Unified response
    return res.status(200).json({ user: normalizeUserOut(user) });
  } catch (err) {
    const code = err?.status || 500;
    console.error('Step upload error:', err?.message || err);
    return res.status(code).json({ error: code === 403 ? 'Forbidden' : 'Step upload failed' });
  }
}

async function handleDeleteSlot(req, res) {
  try {
    const userId = await ensureSelfOr403(req, 'userId');
    const idx = parseInt(req.params.slot, 10);

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

    // Unified response
    return res.status(200).json({ user: normalizeUserOut(user) });
  } catch (err) {
    const code = err?.status || 500;
    console.error('Delete slot error:', err?.message || err);
    return res.status(code).json({ error: code === 403 ? 'Forbidden' : 'Failed to delete photo slot' });
  }
}

/* -----------------------------------------------------------------------------
 * Routers:
 *  1) default export: expects to be mounted at /api and exposes BOTH:
 *       - /users/:userId/...   (new)
 *       - /images/:userId/...  (legacy alias)
 *  2) usersScopedRouter: paths start at /:userId/... to be mounted at /api/users
 * ---------------------------------------------------------------------------- */

// Router intended to be mounted at /api  → provides /users/* and /images/* aliases
const router = express.Router();

// Pre-flight OPTIONS for the wizard step (for both base paths)
router.options('/:userId/photos/upload-photo-step', (_req, res) => res.sendStatus(200));
router.options('/users/:userId/photos/upload-photo-step', (_req, res) => res.sendStatus(200));
router.options('/images/:userId/photos/upload-photo-step', (_req, res) => res.sendStatus(200));

// --- REPLACE START: New-style under /users/* ---
router.post(
  '/users/:userId/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  handleUploadAvatar
);
router.post(
  '/users/:userId/photos',
  authenticate,
  upload.array('photos', 20),
  handleBulkPhotos
);
router.post(
  '/users/:userId/photos/upload-photo-step',
  authenticate,
  upload.single('photo'),
  handlePhotoStep
);
router.delete(
  '/users/:userId/photos/:slot',
  authenticate,
  handleDeleteSlot
);
// --- REPLACE END ---

// --- REPLACE START: Legacy alias under /images/* (same handlers) ---
router.post(
  '/images/:userId/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  handleUploadAvatar
);
router.post(
  '/images/:userId/photos',
  authenticate,
  upload.array('photos', 20),
  handleBulkPhotos
);
router.post(
  '/images/:userId/photos/upload-photo-step',
  authenticate,
  upload.single('photo'),
  handlePhotoStep
);
router.delete(
  '/images/:userId/photos/:slot',
  authenticate,
  handleDeleteSlot
);
// --- REPLACE END ---

// Secondary router for setups that mount at /api/users  → paths begin with /:userId/...
const usersScopedRouter = express.Router();
usersScopedRouter.options('/:userId/photos/upload-photo-step', (_req, res) => res.sendStatus(200));
usersScopedRouter.post('/:userId/upload-avatar', authenticate, upload.single('profilePhoto'), handleUploadAvatar);
usersScopedRouter.post('/:userId/photos', authenticate, upload.array('photos', 20), handleBulkPhotos);
usersScopedRouter.post('/:userId/photos/upload-photo-step', authenticate, upload.single('photo'), handlePhotoStep);
usersScopedRouter.delete('/:userId/photos/:slot', authenticate, handleDeleteSlot);

// Export both: default = router (mount at /api), named = usersScopedRouter (mount at /api/users)
export default router;
export { usersScopedRouter };
// --- REPLACE START/END ---
