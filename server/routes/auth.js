<<<<<<< HEAD
// routes/auth.js

=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
<<<<<<< HEAD
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
=======
const User = require('../models/User');
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678

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
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────────
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

// ─── LOGOUT ───────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  try {
<<<<<<< HEAD
    // Clear only the HttpOnly cookie; omit domain for localhost compatibility
=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/',
<<<<<<< HEAD
=======
      domain: process.env.COOKIE_DOMAIN || req.hostname,
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    });
    return res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────────
router.post(
  '/register',
  validateRegister,
  registerUser
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────────
router.post(
  '/login',
  validateLogin,
  loginUser
);

<<<<<<< HEAD
// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log('🔑 Forgot-password requested for:', email);
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('🔍 No user found for email:', email);
      // Always return success message to avoid user enumeration
      return res.json({
        message:
          'If that email is registered, a reset link has been sent',
      });
    }

    // Generate and save reset token
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1h
    await user.save();

    const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${token}&id=${user._id}`;
    console.log('🔗 Password reset URL:', resetURL);

    const message = [
      'You requested a password reset. Click the link below to set a new password:',
      resetURL,
      '',
      'If you did not request this, please ignore this email.',
    ].join('\n\n');

    await sendEmail(
      user.email,
      'Password Reset Request',
      message
    );
    console.log('✅ Forgot-password email sent to:', user.email);

    return res.json({
      message:
        'If that email is registered, a reset link has been sent',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to process forgot password request' });
  }
});

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { id, token, newPassword } = req.body;
  console.log('🔑 Reset-password attempt for ID:', id);
  if (!id || !token || !newPassword) {
    return res
      .status(400)
      .json({ error: 'Missing required fields' });
  }

  try {
    const hashed = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    const user = await User.findOne({
      _id: id,
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log('❌ Invalid or expired token for ID:', id);
      return res
        .status(400)
        .json({ error: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log('✅ Password reset successful for ID:', id);
    return res.json({
      message: 'Password has been reset successfully',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res
      .status(500)
      .json({ error: 'Failed to reset password' });
  }
});

=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
// ─── GET CURRENT USER ─────────────────────────────────────────────────────────────
router.get(
  '/me',
  authenticate,
  async (req, res) => {
    try {
<<<<<<< HEAD
      const user = await User.findById(req.user.id)
        .select(
          '_id email role profilePicture extraImages isPremium'
        )
=======
      // Return full user object including images and premium flag
      const user = await User.findById(req.user.id)
        .select(' _id email role profilePicture extraImages isPremium')
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
        .lean();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
<<<<<<< HEAD
      return res.json({ user });
    } catch (err) {
      console.error('Fetch /me error:', err);
      return res
        .status(500)
        .json({ error: 'Failed to fetch user' });
=======
      // Respond with user wrapped in 'user'
      return res.json({ user });
    } catch (err) {
      console.error('Fetch /me error:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    }
  }
);

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────────
router.put(
  '/profile',
  authenticate,
  sanitizeFields,
  upload.fields([
<<<<<<< HEAD
    { name: 'image', maxCount: 1 },
=======
    { name: 'image',       maxCount: 1 },
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    { name: 'extraImages', maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const updateData = {};
<<<<<<< HEAD

      // ─── Coordinates ───────────────────────────────────────────────────────────────
      if (req.body.latitude !== undefined) {
        const lat = parseFloat(req.body.latitude);
        if (!isNaN(lat)) updateData.latitude = lat;
      }
      if (req.body.longitude !== undefined) {
        const lng = parseFloat(req.body.longitude);
        if (!isNaN(lng)) updateData.longitude = lng;
      }

      // ─── Nested location handling ────────────────────────────────────────────────
      if (req.body.location) {
        const loc = req.body.location;
        if (loc.country) updateData.country = loc.country;
        if (loc.region) updateData.region = loc.region;
        if (loc.city)   updateData.city   = loc.city;
        if (loc.manualCountry !== undefined) updateData.customCountry = loc.manualCountry;
        if (loc.manualRegion  !== undefined) updateData.customRegion  = loc.manualRegion;
        if (loc.manualCity    !== undefined) updateData.customCity    = loc.manualCity;
      }

      // ─── Other allowed fields ────────────────────────────────────────────────────
=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
        'bodyType',           // persist bodyType
        'weightUnit',         // persist weightUnit
        'profession',         // persist profession
        'professionCategory', // persist professionCategory
      ].forEach((field) => {
=======
      ].forEach(field => {
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

<<<<<<< HEAD
      // ─── File uploads ────────────────────────────────────────────────────────────
=======
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
      if (req.files?.image) {
        updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      }
      if (req.files?.extraImages) {
        updateData.extraImages = req.files.extraImages.map(
<<<<<<< HEAD
          (f) => `uploads/${f.filename}`
=======
          file => `uploads/${file.filename}`
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
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
<<<<<<< HEAD
      return res
        .status(500)
        .json({ error: 'Profile update failed' });
=======
      return res.status(500).json({ error: 'Profile update failed' });
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    }
  }
);

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────────
router.delete(
  '/delete',
  authenticate,
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.user.id);
<<<<<<< HEAD
      return res.json({
        message: 'Account deleted successfully',
      });
    } catch (err) {
      console.error('Account deletion error:', err);
      return res
        .status(500)
        .json({ error: 'Account deletion failed' });
=======
      return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
      console.error('Account deletion error:', err);
      return res.status(500).json({ error: 'Account deletion failed' });
>>>>>>> 8f0979e965914ead7256fcb8048518221a968678
    }
  }
);

module.exports = router;
