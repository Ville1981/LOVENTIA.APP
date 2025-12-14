// --- REPLACE START: conflict markers resolved (kept incoming side) ---
// PATH: server/src/routes/imageRoutes.js

// --- REPLACE START: ESM imports & CJS interop (User/Image) + shared normalizers ---
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

// Auth + upload middlewares (ESM)
import authenticate from '../middleware/authenticate.js';
import { upload } from '../../config/multer.js';

// Models (interop both ESM default and CJS module.exports)
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

import * as ImageModule from '../models/Image.js';
const Image = ImageModule.default || ImageModule;

// S3 client (used to mirror local uploads to AWS S3 so frontend can load them)
// We keep user-visible URLs in the familiar "/uploads/..." format so that the
// client can keep constructing:
//   https://<bucket>.s3.<region>.amazonaws.com/uploads/...
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// PATH: server/src/routes/imageRoutes.js

// --- REPLACE START: Normalization helpers (sanitize uploads paths + strip secrets) ---
/**
 * Normalization helpers – shared with user routes:
 * - toWebPathStrict ensures forward slashes and leading '/'
 * - strips any absolute local prefix and keeps only "/uploads/..."
 * - normalizeUserOut mirrors photos/extraImages and normalizes avatar path
 * - strips sensitive fields from responses (password reset tokens, etc.)
 */
function toWebPathStrict(p) {
  if (!p) return '';

  let s = String(p).trim().replace(/\\/g, '/');

  // If we accidentally get a full URL, keep only its pathname
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = u.pathname || s;
    } catch {
      // keep s as-is
    }
  }

  // Keep only the "/uploads/..." tail if present (prevents "/C:/.../uploads/..." leaks)
  const i = s.indexOf('/uploads/');
  if (i !== -1) {
    s = s.slice(i);
  } else {
    const j = s.indexOf('uploads/');
    if (j !== -1) s = `/${s.slice(j)}`;
  }

  // Normalize duplicate slashes and ensure leading '/'
  s = s.replace(/\/{2,}/g, '/');
  if (!s.startsWith('/')) s = `/${s.replace(/^\/+/, '')}`;

  return s;
}

function normalizeUserOut(u) {
  if (!u) return u;
  const plain = typeof u.toObject === 'function' ? u.toObject() : { ...u };

  // Strip secrets (image routes must NEVER leak these)
  delete plain.password;
  delete plain.passwordResetToken;
  delete plain.passwordResetExpires;
  delete plain.emailVerifyToken;
  delete plain.emailVerifyExpires;

  // Mirror photos/extraImages and normalize paths
  const photosIn = Array.isArray(plain.photos) ? plain.photos : null;
  const extraIn = Array.isArray(plain.extraImages) ? plain.extraImages : null;

  let canonical = photosIn || extraIn || [];
  if (photosIn && extraIn && extraIn.length > photosIn.length) canonical = extraIn;

  const normalizedList = (canonical || []).filter(Boolean).map(toWebPathStrict);
  plain.photos = normalizedList;
  plain.extraImages = normalizedList;

  if (plain.profilePicture) plain.profilePicture = toWebPathStrict(plain.profilePicture);
  if (plain.profilePhoto) plain.profilePhoto = toWebPathStrict(plain.profilePhoto);
  if (plain.avatar) plain.avatar = toWebPathStrict(plain.avatar);

  return plain;
}
// --- REPLACE END ---

/**
 * S3 config + helpers.
 *
 * We intentionally keep this "best effort":
 * - If S3 is not configured or upload fails, we still keep local file paths
 *   so that the rest of the flow works for local dev.
 * - When S3 upload succeeds, objects are stored under the same key as the
 *   web path (without leading slash), for example:
 *     web path:  /uploads/extra/123.gif
 *     S3 key:    uploads/extra/123.gif
 */
const S3_REGION = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.AWS_S3_BUCKET || 'loventia-user-uploads';

let s3Client = null;

function getS3Client() {
  if (!S3_BUCKET) {
    console.warn('[S3] Bucket name not configured, skipping S3 uploads');
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({ region: S3_REGION });
  }
  return s3Client;
}

/**
 * Upload a local file to S3 based on a web-style path.
 *
 * @param {string} webPath    Path like "/uploads/extra/xxx.gif"
 * @param {string} contentType Optional MIME type ("image/gif", "image/jpeg", ...)
 * @returns {Promise<string|null>} Public S3 URL or null on failure.
 */
async function uploadWebPathToS3(webPath, contentType) {
  try {
    const client = getS3Client();
    if (!client) return null;

    if (!webPath) return null;

    const key = String(webPath).replace(/\\/g, '/').replace(/^\/?/, '');
    const localRelPath = key; // same as key but without leading slash
    const absolutePath = path.isAbsolute(localRelPath)
      ? localRelPath
      : path.join(process.cwd(), localRelPath);

    const data = await fs.readFile(absolutePath);

    const putParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: data,
      ACL: 'public-read',
    };

    if (contentType) {
      putParams.ContentType = contentType;
    }

    await client.send(new PutObjectCommand(putParams));
    const publicUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
    console.log('[S3] uploaded', { key, publicUrl });
    return publicUrl;
  } catch (err) {
    console.error('[S3] upload error for', webPath, '-', err?.message || err);
    return null;
  }
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

    // Mirror avatar to S3 (best effort; failure does not block avatar usage)
    await uploadWebPathToS3(avatarUrl, req.file.mimetype);

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

      // Mirror to S3 – best effort
      // We do not await them all in parallel here, to keep behavior predictable.
      // If one S3 upload fails, we still keep the local file.
      // eslint-disable-next-line no-await-in-loop
      await uploadWebPathToS3(url, file.mimetype);

      updated[idx] = url;
      // eslint-disable-next-line no-await-in-loop
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
    const { slot, cropX, cropY, cropWidth, cropHeight, caption } = req.body || {};

    // --- REPLACE START: add debug logging to see multer / S3 vs local metadata ---
    // This log helps us understand why uploaded images are not visible:
    // we can see exactly what fields multer provides (path, location, key, etc.).
    // eslint-disable-next-line no-console
    console.log('[upload-photo-step] file/meta', {
      userId,
      hasFile: !!req.file,
      fieldname: req.file?.fieldname,
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
      path: req.file?.path,
      location: req.file?.location,
      key: req.file?.key,
      bucket: req.file?.bucket,
      slot,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    });
    // --- REPLACE END ---

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const maxSlots = user.isPremium ? 50 : 9;
    const arr = Array.isArray(user.extraImages)
      ? [...user.extraImages]
      : Array(maxSlots).fill(null);

    // If GIF → bypass crop, but still mirror to S3
    if (req.file.mimetype === 'image/gif') {
      const gifUrl = toWebPathStrict(req.file.path || `/uploads/extra/${req.file.filename}`);

      // Mirror GIF to S3 (best effort)
      await uploadWebPathToS3(gifUrl, req.file.mimetype);

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

    // Input/output file paths (robust for absolute/relative + Windows)
const rawFilePath = String(req.file.path || '').trim();

// Multer can return absolute paths (e.g. C:\...\uploads\...) or relative (uploads\...)
// Normalize slashes and build a safe absolute input path.
const normalizedFilePath = rawFilePath.replace(/\\/g, '/');
const isAbs =
  path.isAbsolute(rawFilePath) ||
  /^[a-zA-Z]:[\\/]/.test(rawFilePath) ||
  normalizedFilePath.startsWith('/');

const inPath = isAbs
  ? rawFilePath
  : path.join(process.cwd(), normalizedFilePath.replace(/^\/+/, ''));

// Ensure output directory exists
const outName = `crop_${Date.now()}_${req.file.filename}`;
const outRelPath = path.join('uploads', 'extra', outName);
const outPath = path.join(process.cwd(), outRelPath);
await fs.mkdir(path.dirname(outPath), { recursive: true });

// Safe move helper (handles EXDEV etc.)
async function moveFileSafe(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (e) {
    // Cross-device rename or other fs rename failures → copy+unlink fallback
    if (e?.code === 'EXDEV' || e?.code === 'EPERM' || e?.code === 'EACCES') {
      const data = await fs.readFile(src);
      await fs.writeFile(dest, data);
      await fs.unlink(src).catch(() => {});
    } else {
      throw e;
    }
  }
}

// Bypass Sharp if no valid crop dims
const hasCrop = cropWidth && cropHeight;
if (!hasCrop || +cropWidth === 0 || +cropHeight === 0) {
  await moveFileSafe(inPath, outPath);
} else {
  const left = parseInt(cropX, 10) || 0;
  const top = parseInt(cropY, 10) || 0;
  const width = parseInt(cropWidth, 10);
  const height = parseInt(cropHeight, 10);

  if (!width || !height) {
    await moveFileSafe(inPath, outPath);
  } else {
    try {
      await sharp(inPath).extract({ left, top, width, height }).toFile(outPath);
      await fs.unlink(inPath).catch(() => {});
    } catch (e) {
      console.error('Error cropping:', e);
      return res.status(500).json({ error: 'Failed to crop image', details: e.message });
    }
  }
}

// Clean up if both exist (extra safety)
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

// Assign URL & save – we keep user-facing path in "/uploads/extra/..." format.
const url = toWebPathStrict(outRelPath);

// Mirror cropped image to S3 (best effort)
await uploadWebPathToS3(url, req.file.mimetype || 'image/jpeg');

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
const arr = Array.isArray(user.extraImages) ? [...user.extraImages] : Array(maxSlots).fill(null);

if (!Number.isInteger(idx) || idx < 0 || idx >= maxSlots) {
  return res.status(400).json({ error: 'Invalid slot index' });
}

const imageUrl = arr[idx];
if (imageUrl) {
  // Try local delete (best-effort)
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
router.delete('/users/:userId/photos/:slot', authenticate, handleDeleteSlot);
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
router.delete('/images/:userId/photos/:slot', authenticate, handleDeleteSlot);
// --- REPLACE END ---

// Secondary router for setups that mount at /api/users  → paths begin with /:userId/...
const usersScopedRouter = express.Router();
usersScopedRouter.options('/:userId/photos/upload-photo-step', (_req, res) =>
  res.sendStatus(200)
);
usersScopedRouter.post(
  '/:userId/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  handleUploadAvatar
);
usersScopedRouter.post(
  '/:userId/photos',
  authenticate,
  upload.array('photos', 20),
  handleBulkPhotos
);
usersScopedRouter.post(
  '/:userId/photos/upload-photo-step',
  authenticate,
  upload.single('photo'),
  handlePhotoStep
);
usersScopedRouter.delete('/:userId/photos/:slot', authenticate, handleDeleteSlot);

// Export both: default = router (mount at /api), named = usersScopedRouter (mount at /api/users)
export default router;
export { usersScopedRouter };
// --- REPLACE START/END ---

// --- REPLACE END ---
