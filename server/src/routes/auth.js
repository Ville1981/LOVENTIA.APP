// File: server/src/routes/auth.js
// @ts-nocheck

import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

import User from '../models/User.js';
import sendEmail from '../utils/sendEmail.js';
import { registerUser, loginUser } from '../controllers/userController.js';
import authenticate from '../middleware/authenticate.js';
import { validateRegister, validateLogin } from '../middleware/validators/auth.js';
import { sanitizeAndValidateProfile } from '../middleware/profileValidator.js';
import upload from '../middleware/upload.js';
import { cookieOptions } from '../utils/cookieOptions.js';

const router = express.Router();

// Middleware to parse JSON, URL-encoded bodies, and cookies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

// 1) Refresh Access Token
router.post('/refresh', (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const accessToken = jwt.sign(
      { userId: payload.userId, role: payload.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// 2) Logout User
router.post('/logout', (req, res) => {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    return res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// 3) Register New User
router.post('/register', validateRegister, registerUser);

// 4) Login User
router.post('/login', validateLogin, loginUser);

// 5) Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&id=${user._id}`;
    const message =
      'You requested a password reset. Click the link below to set a new password:\n\n' +
      resetURL +
      '\n\nIf you did not request this, ignore this email.';
    await sendEmail(user.email, 'Password Reset Request', message);
    return res.json({ message: 'If that email is registered, a reset link has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

// 6) Reset Password
router.post('/reset-password', async (req, res) => {
  const { id, token, newPassword } = req.body;
  if (!id || !token || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      _id: id,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// 7) Get Current User Profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('Fetch /me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// 8) Update User Profile
router.put(
  '/profile',
  authenticate,
  sanitizeAndValidateProfile,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'extraImages', maxCount: 6 }
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
      }
      const fields = [
        'name','email','age','height','weight','status','religion',
        'children','pets','summary','goal','lookingFor','bodyType',
        'weightUnit','profession','professionCategory'
      ];
      fields.forEach(field => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      });
      if (req.files.image) updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      if (req.files.extraImages) {
        updateData.extraImages = req.files.extraImages.map(f => `uploads/${f.filename}`);
      }
      const updated = await User.findByIdAndUpdate(
        req.user.userId,
        updateData,
        { new: true }
      ).select('-password');
      return res.json(updated);
    } catch (err) {
      console.error('Profile update error:', err);
      return res.status(500).json({ error: 'Profile update failed' });
    }
  }
);

// 9) Delete User Account
router.delete('/delete', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.userId);
    return res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
});

export default router;
