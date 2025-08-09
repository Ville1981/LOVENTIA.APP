// server/routes/userRoutes.js

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

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Helper to remove files from disk
const removeFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
router.get('/me', authenticate, (req, res) => {
  return res.json(req.user);
});

router.get('/profile', authenticate, (req, res) => {
  return res.json(req.user);
});

router.put(
  '/profile',
  authenticate,
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'extraImages', maxCount: 20 },
  ]),
  handleValidation,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // Update text fields
      Object.entries(req.body).forEach(([key, value]) => {
        if (value !== undefined && key in user) user[key] = value;
      });

      // Handle JSON profilePicture
      if (req.body.profilePhoto) user.profilePicture = req.body.profilePhoto;

      // Handle multipart uploads
      if (req.files?.profilePhoto) {
        if (user.profilePicture) removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      if (req.files?.extraImages) {
        if (Array.isArray(user.extraImages)) {
          user.extraImages.forEach(removeFile);
        }
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      const updatedUser = await user.save();
      return res.json(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
    }
  }
);

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
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
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

