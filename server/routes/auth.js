// server/routes/auth.js
// @ts-nocheck

import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

import User from '../models/User.js';
import sendEmail from '../src/utils/sendEmail.js';
import { registerUser, loginUser } from '../controllers/userController.js';
import upload from '../middleware/upload.js';
import authenticate from '../middleware/authenticate.js';
import { sanitizeAndValidateProfile } from '../middleware/profileValidator.js';
import { validateRegister, validateLogin } from '../middleware/validators/auth.js';
import { cookieOptions } from '../src/utils/cookieOptions.js';

const router = express.Router();

// parse JSON, urlencoded bodies, and cookies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

// -----------------------------
// 1) Refresh Access Token
//    POST /api/auth/refresh
// -----------------------------
router.post('/refresh', (req, res) => {
  // --- REPLACE START: read and verify refresh token ---
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
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
  // --- REPLACE END ---
});

// -----------------------------
// 2) Logout User
//    POST /api/auth/logout
// -----------------------------
router.post('/logout', (req, res) => {
  try {
    // --- REPLACE START: clear refresh cookie ---
    res.clearCookie('refreshToken', cookieOptions);
    // --- REPLACE END ---
    return res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// -----------------------------
// 3) Register New User
//    POST /api/auth/register
// -----------------------------
router.post('/register', validateRegister, registerUser);

// -----------------------------
// 4) Login User
//    POST /api/auth/login
// -----------------------------
router.post('/login', validateLogin, loginUser);

// -----------------------------
// 5) Forgot Password
//    POST /api/auth/forgot-password
// -----------------------------
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // don't reveal whether email exists
      return res.json({ message: 'If that email is registered, a reset link has been sent' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = Date.now() + 3600000; // 1h
    await user.save();
    const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${token}&id=${user._id}`;
    const message = [
      'You requested a password reset. Click the link below to set a new password:',
      resetURL,
      '',
      'If you did not request this, ignore this email.'
    ].join('\n\n');
    await sendEmail(user.email, 'Password Reset Request', message);
    return res.json({ message: 'If that email is registered, a reset link has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

// -----------------------------
// 6) Reset Password
//    POST /api/auth/reset-password
// -----------------------------
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

// -----------------------------
// 7) Get Current User Profile
//    GET /api/auth/me
// -----------------------------
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('Fetch /me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// -----------------------------
// 8) Update User Profile
//    PUT /api/auth/profile
// -----------------------------
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
      // coordinates
      if (req.body.latitude !== undefined) {
        const lat = parseFloat(req.body.latitude);
        if (!isNaN(lat)) updateData.latitude = lat;
      }
      if (req.body.longitude !== undefined) {
        const lng = parseFloat(req.body.longitude);
        if (!isNaN(lng)) updateData.longitude = lng;
      }
      // location object
      if (req.body.location) {
        const loc = req.body.location;
        if (loc.country) updateData.country = loc.country;
        if (loc.region) updateData.region = loc.region;
        if (loc.city) updateData.city = loc.city;
        if (loc.manualCountry) updateData.customCountry = loc.manualCountry;
        if (loc.manualRegion) updateData.customRegion = loc.manualRegion;
        if (loc.manualCity) updateData.customCity = loc.manualCity;
      }
      // simple fields
      [
        'name','email','age','height','weight','status','religion',
        'children','pets','summary','goal','lookingFor','bodyType',
        'weightUnit','profession','professionCategory'
      ].forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });
      // file uploads
      if (req.files.image) {
        updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      }
      if (req.files.extraImages) {
        updateData.extraImages = req.files.extraImages.map(f => `uploads/${f.filename}`);
      }
      const updated = await User.findByIdAndUpdate(
        req.user.id,
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

// -----------------------------
// 9) Delete User Account
//    DELETE /api/auth/delete
// -----------------------------
router.delete('/delete', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    return res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
});

// --- REPLACE START: ESM export ---
export default router;
// --- REPLACE END ---
