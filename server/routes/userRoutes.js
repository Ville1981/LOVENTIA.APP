// server/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const { body, validationResult } = require('express-validator');

// Import the User model and controller functions
const User = require('../models/User');
const {
  registerUser,
  loginUser,
  getMatchesWithScore,
  upgradeToPremium,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
} = require('../controllers/userController');

// Import authentication middleware
const { authenticate } = require('../middleware/authMiddleware');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Helper to remove files from disk
const removeFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Validation error handler
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Parse JSON and URL-encoded bodies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// =====================
// Authentication Routes
// =====================

// Register a new user
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

// Login a user
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

// Get current authenticated user
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// Alias for profile
router.get('/profile', authenticate, (req, res) => {
  res.json(req.user);
});

// Update user profile
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
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update text fields
      Object.entries(req.body).forEach(([key, value]) => {
        if (value !== undefined && key in user) {
          user[key] = value;
        }
      });

      // Update profile picture
      if (req.files.profilePhoto) {
        if (user.profilePicture) removeFile(user.profilePicture);
        user.profilePicture = req.files.profilePhoto[0].path;
      }

      // Update extra images
      if (req.files.extraImages) {
        user.extraImages.forEach((img) => removeFile(img));
        user.extraImages = req.files.extraImages.map((f) => f.path);
      }

      const updatedUser = await user.save();
      res.json(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Profile update failed' });
    }
  }
);

// =====================
// Social Interaction Routes
// =====================

// Like another user
router.post('/like/:id', authenticate, async (req, res) => {
  // TODO: implement like logic
  res.json({ message: 'User liked' });
});

// Superlike another user
router.post('/superlike/:id', authenticate, async (req, res) => {
  // TODO: implement superlike logic
  res.json({ message: 'User superliked' });
});

// Block a user
router.post('/block/:id', authenticate, async (req, res) => {
  // TODO: implement block logic
  res.json({ message: 'User blocked' });
});

// =====================
// Premium and Matches
// =====================

// Upgrade to premium
router.post('/upgrade-premium', authenticate, upgradeToPremium);

// Get match suggestions with score
router.get('/matches', authenticate, getMatchesWithScore);

// =====================
// Additional User Info
// =====================

// Who liked me
router.get('/who-liked-me', authenticate, async (req, res) => {
  // TODO: implement logic
  res.json([]);
});

// Nearby users
router.get('/nearby', authenticate, async (req, res) => {
  // TODO: implement logic
  res.json([]);
});

// =====================
// Photo Upload Routes
// =====================

// Upload or replace profile avatar
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
      res.json({ profilePicture: user.profilePicture });
    } catch (err) {
      console.error('Upload-avatar error:', err);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

// Bulk upload extra photos
router.post(
  '/:id/upload-photos',
  authenticate,
  upload.array('photos', 20),
  uploadExtraPhotos
);

// Upload a single photo step
router.post(
  '/:id/upload-photo-step',
  authenticate,
  upload.single('photo'),
  uploadPhotoStep
);

// Delete a specific photo slot
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
    res.json(user);
  } catch (err) {
    console.error('Public profile fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
