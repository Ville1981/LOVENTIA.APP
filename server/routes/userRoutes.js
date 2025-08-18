import express from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import { body, validationResult } from 'express-validator';

// --- REPLACE START: interop for CommonJS User model (fixed path from routes -> models) ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;
// --- REPLACE END ---

// --- REPLACE START: interop for controllers (FIX: match on-disk casing exactly = userController.js) ---
import * as UC from '../controllers/userController.js';
const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
  getMe,
  updateProfile,
} = (UC.default || UC);
// --- REPLACE END ---

// --- REPLACE START: import authenticate middleware correctly (fixed path) ---
import authenticate from '../middleware/authenticate.js';
// --- REPLACE END ---

const router = express.Router();

/* ──────────────────────────────────────────────────────────────────────────────
   Upload setup
────────────────────────────────────────────────────────────────────────────── */
const ensureUploadsDir = () => {
  const dir = path.resolve('uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};
ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

const removeFile = (filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    const p = path.resolve(filePath);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  } catch (e) {
    console.warn('removeFile warning:', e?.message || e);
  }
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/* ──────────────────────────────────────────────────────────────────────────────
   Auth routes
────────────────────────────────────────────────────────────────────────────── */
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  registerUser
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidation,
  loginUser
);

// --- REPLACE START: return full user document via controller getMe ---
router.get('/me', authenticate, async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return getMe(req, res);
  } catch (err) {
    console.error('GET /users/me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return getMe(req, res);
  } catch (err) {
    console.error('GET /users/profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Profile update
────────────────────────────────────────────────────────────────────────────── */
const UPDATABLE_FIELDS = new Set([
  'username',
  'email',
  'summary',
  'gender',
  'orientation',
  'goal',
  'lookingFor',
  'age',
  'height',
  'heightUnit',
  'weight',
  'weightUnit',
  'city',
  'region',
  'country',
  'customCity',
  'customRegion',
  'customCountry',
  'profession',
  'professionCategory',
  'education',
  'religion',
  'religionImportance',
  'children',
  'pets',
  'nutritionPreferences',
  'activityLevel',
  'healthInfo',
  'smoke',
  'drink',
  'drugs',
  'latitude',
  'longitude',
  'profilePhoto',
  'extraImages',
  // --- REPLACE START: allow Political ideology updates from client ---
  'politicalIdeology',
  // --- REPLACE END ---
]);

// --- REPLACE START: add hybrid PUT /profile with location mapping ---
router.put(
  '/profile',
  authenticate,
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'extraImages', maxCount: 20 },
  ]),
  async (req, res) => {
    try {
      const uid = req.user?.id || req.user?._id || req.user?.userId;
      if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasProfilePhoto =
        Array.isArray(req.files?.profilePhoto) && req.files.profilePhoto.length > 0;
      const hasExtraImages =
        Array.isArray(req.files?.extraImages) && req.files.extraImages.length > 0;
      const hasFiles = hasProfilePhoto || hasExtraImages;

      // If no files uploaded, delegate to controller (keeps existing behavior)
      if (!hasFiles) {
        // Controller's updateProfile will still work; we add an extra safety mapping below
        // when handling files locally.
        return updateProfile(req, res);
      }

      // With files: do local update + save
      const user = await User.findById(uid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Assign scalar fields from body
      if (req.body && typeof req.body === 'object') {
        for (const [key, val] of Object.entries(req.body)) {
          if (!UPDATABLE_FIELDS.has(key)) continue;
          if (key === 'nutritionPreferences' || key === 'extraImages') {
            let parsed = val;
            if (typeof val === 'string') {
              try {
                parsed = JSON.parse(val);
              } catch {
                // keep as-is; may be a single string
              }
            }
            user[key] = parsed;
          } else {
            user[key] = val;
          }
        }
      }

      // --- REPLACE START: map top-level country/region/city -> nested location before save ---
      /**
       * Ensure that top-level "country/region/city" from the profile form end up in
       * the canonical nested schema: user.location.{country,region,city}.
       * Also accept optional dot-notation "location.country" if ever sent.
       */
      const hasTopCountry = Object.prototype.hasOwnProperty.call(req.body || {}, 'country');
      const hasTopRegion  = Object.prototype.hasOwnProperty.call(req.body || {}, 'region');
      const hasTopCity    = Object.prototype.hasOwnProperty.call(req.body || {}, 'city');

      const hasDotCountry = Object.prototype.hasOwnProperty.call(req.body || {}, 'location.country');
      const hasDotRegion  = Object.prototype.hasOwnProperty.call(req.body || {}, 'location.region');
      const hasDotCity    = Object.prototype.hasOwnProperty.call(req.body || {}, 'location.city');

      if (hasTopCountry || hasTopRegion || hasTopCity || hasDotCountry || hasDotRegion || hasDotCity) {
        user.location = user.location || {};
        if (hasTopCountry) user.location.country = req.body.country;
        if (hasTopRegion)  user.location.region  = req.body.region;
        if (hasTopCity)    user.location.city    = req.body.city;

        if (hasDotCountry) user.location.country = req.body['location.country'];
        if (hasDotRegion)  user.location.region  = req.body['location.region'];
        if (hasDotCity)    user.location.city    = req.body['location.city'];
      }
      // --- REPLACE END ---

      // Files: profile photo
      if (hasProfilePhoto) {
        if (user.profilePicture) removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // Files: extra images
      if (hasExtraImages) {
        if (Array.isArray(user.extraImages)) {
          user.extraImages.forEach(removeFile);
        }
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      // Optional: front might send an existing relative path (no new upload)
      if (typeof req.body?.profilePhoto === 'string' && req.body.profilePhoto.trim()) {
        user.profilePicture = req.body.profilePhoto.trim();
      }

      const updatedUser = await user.save();
      return res.json({ user: updatedUser });
    } catch (err) {
      console.error('PUT /users/profile error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
    }
  }
);
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Account deletion (DELETE /users/me)
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: add safe cascade delete for the authenticated user ---
/**
 * Safely deletes a user and attempts to cascade-delete related assets:
 *  - Removes profile picture and extra images from disk.
 *  - Deletes related messages if a Message model exists (best-effort).
 *  - Finally deletes the user document itself.
 *
 * This function is defensive: if a related collection/model is missing,
 * it will not throw; it logs and continues with user deletion.
 */
const cascadeDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return { deletedUser: false, removedFiles: 0, deletedMessages: 0 };

  // Remove files from disk
  let removedFiles = 0;
  try {
    if (user.profilePicture) {
      removeFile(user.profilePicture);
      removedFiles += 1;
    }
    if (Array.isArray(user.extraImages) && user.extraImages.length > 0) {
      for (const img of user.extraImages) {
        removeFile(img);
        removedFiles += 1;
      }
    }
  } catch (e) {
    console.warn('File cleanup warning:', e?.message || e);
  }

  // Best-effort: delete messages if model exists
  let deletedMessages = 0;
  try {
    // Try dynamic import to avoid hard dependency if model/file is absent
    const MsgModule = await import('../models/Message.js').catch(() => null);
    const Message = MsgModule?.default || MsgModule;
    if (Message && typeof Message.deleteMany === 'function') {
      const res1 = await Message.deleteMany({ sender: userId });
      const res2 = await Message.deleteMany({ receiver: userId });
      // Some schemas might use participants array; try that too (won't fail if no index)
      const res3 = await Message.deleteMany({ participants: userId }).catch(() => ({ deletedCount: 0 }));
      deletedMessages =
        (res1?.deletedCount || 0) + (res2?.deletedCount || 0) + (res3?.deletedCount || 0);
    }
  } catch (e) {
    console.warn('Message cleanup skipped:', e?.message || e);
  }

  // Finally delete the user document
  await User.findByIdAndDelete(userId);

  return { deletedUser: true, removedFiles, deletedMessages };
};

router.delete('/me', authenticate, async (req, res) => {
  try {
    const uid = req.user?.id || req.user?._id || req.user?.userId;
    if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await cascadeDeleteUser(String(uid));

    // No content is standard, but include minimal headers for clients if needed
    // You can switch to 200 with JSON if you want to inspect result details.
    if (!result.deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Optional debug header info (safe, not required)
    res.setHeader('X-Removed-Files', String(result.removedFiles || 0));
    res.setHeader('X-Deleted-Messages', String(result.deletedMessages || 0));

    return res.status(204).send(); // No Content
  } catch (err) {
    console.error('DELETE /users/me error:', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Social
────────────────────────────────────────────────────────────────────────────── */
router.post('/like/:id', authenticate, async (_req, res) => {
  return res.json({ message: 'User liked' });
});

router.post('/superlike/:id', authenticate, async (_req, res) => {
  return res.json({ message: 'User superliked' });
});

router.post('/block/:id', authenticate, async (_req, res) => {
  return res.json({ message: 'User blocked' });
});

/* ──────────────────────────────────────────────────────────────────────────────
   Premium & matches
────────────────────────────────────────────────────────────────────────────── */
router.post('/upgrade-premium', authenticate, upgradeToPremium);
router.get('/matches', authenticate, getMatchesWithScore);

/* ──────────────────────────────────────────────────────────────────────────────
   Misc
────────────────────────────────────────────────────────────────────────────── */
router.get('/who-liked-me', authenticate, async (_req, res) => {
  return res.json([]);
});

router.get('/nearby', authenticate, async (_req, res) => {
  return res.json([]);
});

/* ──────────────────────────────────────────────────────────────────────────────
   Photo upload
────────────────────────────────────────────────────────────────────────────── */
router.post(
  '/:id/upload-avatar',
  authenticate,
  upload.single('profilePhoto'),
  async (req, res) => {
    try {
      const uid = req.user?.id || req.user?._id || req.user?.userId;
      const user = await User.findById(uid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (user.profilePicture) removeFile(user.profilePicture);
      user.profilePicture = req.file.path;
      await user.save();
      return res.json({ profilePicture: user.profilePicture });
    } catch (err) {
      console.error('Upload-avatar error:', err);
      return res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

router.post(
  '/:id/upload-photos',
  authenticate,
  upload.array('photos', 20),
  uploadExtraPhotos
);

router.post(
  '/:id/upload-photo-step',
  authenticate,
  upload.single('photo'),
  uploadPhotoStep
);

router.delete('/:id/photos/:slot', authenticate, deletePhotoSlot);

/* ──────────────────────────────────────────────────────────────────────────────
   Param validation
────────────────────────────────────────────────────────────────────────────── */
router.param('id', (_req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  next();
});

/* ──────────────────────────────────────────────────────────────────────────────
   Public profile
────────────────────────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -email -blockedUsers'
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    console.error('Public profile fetch error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
