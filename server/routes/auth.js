const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');

const {
  registerUser,
  loginUser,
} = require('../controllers/userController');
const upload = require('../middleware/upload');
const authenticate = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
} = require('../middleware/validators/auth');
const { sanitizeFields } = require('../middleware/sanitizer');

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
// Parse JSON bodies
router.use(express.json());
// Parse URL-encoded bodies (for form submissions)
router.use(express.urlencoded({ extended: true }));
// Parse cookies
router.use(cookieParser());

// ─── 🔄 REFRESH TOKEN ───────────────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const accessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// ─── 🔐 LOGOUT ─────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || req.hostname,
    });
    return res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── 🆕 REGISTER ────────────────────────────────────────────────────────────────
router.post(
  '/register',
  validateRegister,
  registerUser
);

// ─── 🔑 LOGIN ───────────────────────────────────────────────────────────────────
router.post(
  '/login',
  validateLogin,
  loginUser
);

// ─── 👤 GET CURRENT USER ───────────────────────────────────────────────────────
router.get(
  '/me',
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('_id email role');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        id:   user._id,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      console.error('Fetch /me error:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// ─── 🖼️ UPDATE PROFILE ─────────────────────────────────────────────────────────
router.put(
  '/profile',
  authenticate,
  sanitizeFields,
  upload.fields([
    { name: 'image',       maxCount: 1 },
    { name: 'extraImages', maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const updateData = {};
      [
        'name',
        'email',
        'age',
        'height',
        'weight',
        'status',
        'religion',
        'children',
        'pets',
        'summary',
        'goal',
        'lookingFor',
      ].forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      if (req.files?.image) {
        updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      }
      if (req.files?.extraImages) {
        updateData.extraImages = req.files.extraImages.map(
          file => `uploads/${file.filename}`
        );
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true }
      ).select('-password');

      return res.json(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
    }
  }
);

// ─── 🗑️ DELETE ACCOUNT ─────────────────────────────────────────────────────────
router.delete(
  '/delete',
  authenticate,
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.user.id);
      return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
      console.error('Account deletion error:', err);
      return res.status(500).json({ error: 'Account deletion failed' });
    }
  }
);

module.exports = router;
