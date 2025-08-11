import express from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import multer from 'multer';
import { body, validationResult } from 'express-validator';

// --- REPLACE START: interop for CommonJS User model ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;
// --- REPLACE END ---

// --- REPLACE START: interop for controllers (works with ESM or CommonJS) ---
import * as UC from '../controllers/userController.js';
const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
} = (UC.default || UC);
// --- REPLACE END ---

// --- REPLACE START: import authenticate middleware correctly ---
import authenticate from '../middleware/authenticate.js';
// --- REPLACE END ---

// Ensure uploads directory exists (multer will fail otherwise)
const ensureUploadsDir = () => {
  const dir = path.resolve('uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
ensureUploadsDir();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Helper to remove files from disk
const removeFile = (filePath) => {
  try {
    if (filePath && typeof filePath === 'string') {
      const p = path.resolve(filePath);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (e) {
    // swallow file removal errors (best-effort)
    console.warn('removeFile warning:', e?.message || e);
  }
};

// Validation error handler
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const router = express.Router();

// =====================
// Authentication Routes
// =====================
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

// =====================
// Protected User Routes
// =====================
// --- REPLACE START: return shape unified as { user: ... } ---
router.get('/me', authenticate, (req, res) => {
  return res.json({ user: req.user || null });
});

router.get('/profile', authenticate, (req, res) => {
  return res.json({ user: req.user || null });
});
// --- REPLACE END ---

/**
 * Allow-list of fields the client may update via PUT /profile
 * Keeps server-side control over what can change.
 */
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
  'profilePhoto',      // JSON/url string
  'extraImages',       // JSON array (when not using multipart)
]);

// --- REPLACE START: add missing PUT /profile to update the current user ---
router.put(
  '/profile',
  authenticate,
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 }, // file field for avatar (optional)
    { name: 'extraImages', maxCount: 20 }, // file field(s) for gallery (optional)
  ]),
  async (req, res) => {
    try {
      // resolve authenticated user id safely regardless of middleware shape
      const uid = req.user?.id || req.user?._id || req.user?.userId;
      if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await User.findById(uid);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // 1) Update text/JSON fields from req.body (allow-list only)
      if (req.body && typeof req.body === 'object') {
        for (const [key, val] of Object.entries(req.body)) {
          if (!UPDATABLE_FIELDS.has(key)) continue;
          // handle arrays coming as JSON-encoded strings
          if (key === 'nutritionPreferences' || key === 'extraImages') {
            let parsed = val;
            if (typeof val === 'string') {
              try { parsed = JSON.parse(val); } catch { /* keep as string if not JSON */ }
            }
            user[key] = parsed;
          } else {
            user[key] = val;
          }
        }
      }

      // 2) Handle multipart: avatar + extra images
      // avatar in file field
      if (req.files?.profilePhoto?.[0]) {
        if (user.profilePicture) removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }
      // extra images in files
      if (Array.isArray(req.files?.extraImages) && req.files.extraImages.length) {
        // if you want to replace all existing:
        if (Array.isArray(user.extraImages)) user.extraImages.forEach(removeFile);
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      // 3) If client sent JSON profilePhoto field (URL string), prefer it
      if (typeof req.body?.profilePhoto === 'string' && req.body.profilePhoto.trim()) {
        user.profilePicture = req.body.profilePhoto.trim();
      }

      const updatedUser = await user.save();
      // keep response shape consistent for front-end hooks/services
      return res.json({ user: updatedUser });
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
    }
  }
);
// --- REPLACE END ---

// =====================
// Social Interaction Routes
// =====================
router.post('/like/:id', authenticate, async (req, res) => {
  // TODO: implement like logic
  return res.json({ message: 'User liked' });
});

router.post('/superlike/:id', authenticate, async (req, res) => {
  // TODO: implement superlike logic
  return res.json({ message: 'User superliked' });
});

router.post('/block/:id', authenticate, async (req, res) => {
  // TODO: implement block logic
  return res.json({ message: 'User blocked' });
});

// =====================
// Premium and Matches
// =====================
router.post('/upgrade-premium', authenticate, upgradeToPremium);
router.get('/matches', authenticate, getMatchesWithScore);

// =====================
// Additional User Info
// =====================
router.get('/who-liked-me', authenticate, async (req, res) => {
  // TODO: implement logic
  return res.json([]);
});

router.get('/nearby', authenticate, async (req, res) => {
  // TODO: implement logic
  return res.json([]);
});

// =====================
// Photo Upload Routes
// =====================
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

// =====================
// Param Validation
// =====================
router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  next();
});

// =====================
// Public Profile by ID
// =====================
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
