// --- REPLACE START: Make ESM modules work cleanly (no require in ESM), keep dynamic imports ---
import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// --- REPLACE START: Load User model with robust ESM/CJS interop (no require()) ---
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;
// --- REPLACE END ---

// Utility to convert relative paths to file URL for dynamic ESM imports
function toURL(p) {
  return pathToFileURL(path.resolve(__dirname, p)).href;
}

// --- REPLACE START: point utils to server/utils (not src/) ---
const sendEmailURL     = toURL('../utils/sendEmail.js');
const cookieOptionsURL = toURL('../utils/cookieOptions.js');
// --- REPLACE END ---

let _sendEmailPromise = null;
let _cookieOptsPromise = null;

async function loadSendEmail() {
  if (!_sendEmailPromise) _sendEmailPromise = import(sendEmailURL);
  const mod = await _sendEmailPromise;
  // default export or named function
  return mod.default || mod.sendEmail || mod;
}

async function loadCookieOptions() {
  if (!_cookieOptsPromise) _cookieOptsPromise = import(cookieOptionsURL);
  try {
    const mod = await _cookieOptsPromise;
    // named export { cookieOptions } or default with cookieOptions
    return mod.cookieOptions || mod.default?.cookieOptions || {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    };
  } catch (_e) {
    // Safe fallback if the utils file is missing
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    };
  }
}

// --- Dynamic imports for ESM controllers/middlewares ---
const userControllerURL   = toURL('../controllers/userController.js');
const uploadURL           = toURL('../middleware/upload.js');
const authenticateURL     = toURL('../middleware/authenticate.js');
const profileValidatorURL = toURL('../middleware/profileValidator.js');
const validatorsURL       = toURL('../middleware/validators/auth.js');

let _userControllerPromise = null;
function loadUserController() {
  if (!_userControllerPromise) _userControllerPromise = import(userControllerURL);
  return _userControllerPromise;
}

async function registerUser(req, res, next) {
  try {
    const m = await loadUserController();
    const fn = m.registerUser || m.default?.registerUser || m.default || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}

async function loginUser(req, res, next) {
  try {
    const m = await loadUserController();
    const fn = m.loginUser || m.default?.loginUser || m.default || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}

// upload wrapper: preserve .fields([...]) API for our multer-based middleware
const upload = {
  fields: (spec) => {
    return async (req, res, next) => {
      try {
        const m = await import(uploadURL);
        const u = m.default || m.upload || m;
        if (!u?.fields) {
          throw new TypeError('Upload middleware missing .fields() method');
        }
        const handler = u.fields(spec);
        return handler(req, res, next);
      } catch (err) {
        return next(err);
      }
    };
  },
};

// authenticate wrapper
async function authenticate(req, res, next) {
  try {
    const m = await import(authenticateURL);
    const fn = m.default || m.authenticate || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}

// sanitize + validate profile wrapper
async function sanitizeAndValidateProfile(req, res, next) {
  try {
    const m = await import(profileValidatorURL);
    const fn =
      m.sanitizeAndValidateProfile ||
      m.default?.sanitizeAndValidateProfile ||
      m.default || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}

// validators: validateRegister / validateLogin
async function validateRegister(req, res, next) {
  try {
    const m = await import(validatorsURL);
    const fn = m.validateRegister || m.default?.validateRegister || m.default || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}
async function validateLogin(req, res, next) {
  try {
    const m = await import(validatorsURL);
    const fn = m.validateLogin || m.default?.validateLogin || m.default || m;
    return fn(req, res, next);
  } catch (err) {
    return next(err);
  }
}
// --- REPLACE END ---

// parse JSON, urlencoded bodies, and cookies
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());

// -----------------------------
// 1) Refresh Access Token
//    POST /api/auth/refresh
// -----------------------------
router.post('/refresh', async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    // Be tolerant: some code uses { id }, others use { userId }
    const userId = decoded?.userId || decoded?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    const accessToken = jwt.sign(
      { userId, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ accessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// -----------------------------
// 2) Logout User
//    POST /api/auth/logout
// -----------------------------
router.post('/logout', async (req, res) => {
  try {
    const cookieOptions = await loadCookieOptions();
    res.clearCookie('refreshToken', cookieOptions);
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
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Do not reveal whether an email exists
      return res.json({ message: 'If that email is registered, a reset link has been sent' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken   = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const base = process.env.CLIENT_URL || 'http://localhost:5174';
    const resetURL = `${base}/reset-password?token=${token}&id=${user._id}`;

    const message = [
      'You requested a password reset. Click the link below to set a new password:',
      resetURL,
      '',
      'If you did not request this, ignore this email.'
    ].join('\n\n');

    const sendEmail = await loadSendEmail();
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
  const { id, token, newPassword } = req.body || {};
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
    user.passwordResetToken   = undefined;
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
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const user = await User.findById(userId).select('-password');
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

      // Geo fields
      if (req.body?.latitude !== undefined) {
        const lat = parseFloat(req.body.latitude);
        if (!Number.isNaN(lat)) updateData.latitude = lat;
      }
      if (req.body?.longitude !== undefined) {
        const lng = parseFloat(req.body.longitude);
        if (!Number.isNaN(lng)) updateData.longitude = lng;
      }

      // Optional location object
      if (req.body?.location) {
        const loc = req.body.location;
        if (loc.country) updateData.country = loc.country;
        if (loc.region)  updateData.region  = loc.region;
        if (loc.city)    updateData.city    = loc.city;
        if (loc.manualCountry) updateData.customCountry = loc.manualCountry;
        if (loc.manualRegion)  updateData.customRegion  = loc.manualRegion;
        if (loc.manualCity)    updateData.customCity    = loc.manualCity;
      }

      // Whitelisted profile fields
      [
        'name','email','age','height','weight','status','religion',
        'children','pets','summary','goal','lookingFor','bodyType',
        'weightUnit','profession','professionCategory'
      ].forEach((field) => {
        if (req.body?.[field] !== undefined) updateData[field] = req.body[field];
      });

      // Files
      if (req.files && req.files.image) {
        updateData.profilePicture = `uploads/${req.files.image[0].filename}`;
      }
      if (req.files && req.files.extraImages) {
        updateData.extraImages = req.files.extraImages.map((f) => `uploads/${f.filename}`);
      }

      const userId = req.user?.userId || req.user?.id || req.user?._id;
      const updated = await User.findByIdAndUpdate(
        userId,
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
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    await User.findByIdAndDelete(userId);
    return res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
});

export default router;
// --- REPLACE END ---
