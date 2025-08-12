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
  // keep controllers available for delegation without shortening routes
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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

const removeFile = (filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') return;
    const p = path.resolve(filePath);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {
    console.warn('removeFile warning:', e?.message || e);
  }
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
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

// --- REPLACE START: return full user document via controller getMe (keeps validation block size) ---
router.get('/me', authenticate, async (req, res) => {
  try {
    const id = req.user?.id || req.user?._id || req.user?.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Delegate to controller to unify payload (no secrets)
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
    // Delegate to controller to unify payload (no secrets)
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
]);

// --- REPLACE START: add hybrid PUT /profile (delegates to controller when no files) ---
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

      // If there are no files, delegate to controller (JSON-only path)
      const hasProfilePhoto = Array.isArray(req.files?.profilePhoto) && req.files.profilePhoto.length > 0;
      const hasExtraImages = Array.isArray(req.files?.extraImages) && req.files.extraImages.length > 0;
      const hasFiles = hasProfilePhoto || hasExtraImages;

      if (!hasFiles) {
        return updateProfile(req, res);
      }

      // With files: keep in-route behavior (existing logic preserved)
      const user = await User.findById(uid);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (req.body && typeof req.body === 'object') {
        for (const [key, val] of Object.entries(req.body)) {
          if (!UPDATABLE_FIELDS.has(key)) continue;
          if (key === 'nutritionPreferences' || key === 'extraImages') {
            let parsed = val;
            if (typeof val === 'string') {
              try { parsed = JSON.parse(val); } catch {}
            }
            user[key] = parsed;
          } else {
            user[key] = val;
          }
        }
      }

      if (hasProfilePhoto) {
        if (user.profilePicture) removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      if (hasExtraImages) {
        if (Array.isArray(user.extraImages)) user.extraImages.forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      // Allow passing already-uploaded path for profilePhoto (e.g., from crop flow)
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
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

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
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('Public profile fetch error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
