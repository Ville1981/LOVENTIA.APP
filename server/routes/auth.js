// routes/auth.js

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

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
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (!decoded?.id) return res.status(401).json({ error: 'Invalid token payload' });
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
    // Clear refreshToken cookie
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

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'If that email is registered, a reset link has been sent' });
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save();
    const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${token}&id=${user._id}`;
    const message = [
      'You requested a password reset. Click the link below to set a new password:',
      resetURL,
      '',
      'If you did not request this, please ignore this email.',
    ].join('\n\n');
    await sendEmail(user.email, 'Password Reset Request', message);
    return res.json({ message: 'If that email is registered, a reset link has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { id, token, newPassword } = req.body;
  if (!id || !token || !newPassword) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ _id: id, passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────────
router.get(
  '/me',
  authenticate,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('_id email role profilePicture extraImages isPremium')
        .lean();
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json({ user });
    } catch (err) {
      console.error('Fetch /me error:', err);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────────
router.put(
  '/profile',
  authenticate,
  sanitizeFields,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'extraImages', maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const updateData = {};
      if (req.body.latitude !== undefined) {
        const lat = parseFloat(req.body.latitude);
        if (!isNaN(lat)) updateData.latitude = lat;
      }
      if (req.body.longitude !== undefined) {
        const lng = parseFloat(req.body.longitude);
        if (!isNaN(lng)) updateData.longitude = lng;
      }
      if (req.body.location) {
        const loc = req.body.location;
        if (loc.country) updateData.country = loc.country;
        if (loc.region) updateData.region = loc.region;
        if (loc.city) updateData.city = loc.city;
        if (loc.manualCountry !== undefined) updateData.customCountry = loc.manualCountry;
        if (loc.manualRegion !== undefined) updateData.customRegion = loc.manualRegion;
        if (loc.manualCity !== undefined) updateData.customCity = loc.manualCity;
      }
      ['name','email','age','height','weight','status','religion','children','pets','summary','goal','lookingFor','bodyType','weightUnit','profession','professionCategory']
        .forEach(field => { if (req.body[field] !== undefined) updateData[field] = req.body[field]; });
      if (req.files?.image) updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      if (req.files?.extraImages) updateData.extraImages = req.files.extraImages.map(file => `uploads/${file.filename}`);
      const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
      return res.json(updatedUser);
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
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
      return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
      console.error('Account deletion error:', err);
      return res.status(500).json({ error: 'Account deletion failed' });
    }
  }
);

module.exports = router;
