// --- REPLACE START: ESM imports (robust CJS/ESM interop for User model) ---
import 'dotenv/config';
// NOTE: The User model may be exported via CommonJS (module.exports = UserModel).
// Use a safe interop pattern so this file works in an ESM runtime.
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
// --- REPLACE END ---

// Configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

// Centralized cookie options for refresh token
const refreshCookieOptions = {
  httpOnly: true,
  secure: IS_PROD,                   // HTTPS only in production
  sameSite: IS_PROD ? 'none' : 'lax',// allow cross-site only in prod
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
  // domain can be optionally set via COOKIE_DOMAIN env
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};

/**
 * Utility: remove a file from disk
 */
export function removeFile(filePath) {
  if (!filePath) return;
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error('Failed to remove file', filePath, err);
  }
}

/**
 * Register a new user with hashed password
 */
export async function registerUser(req, res) {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Username, email and password are required' });
  }
  try {
    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    if (await User.exists({ username })) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });
    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during registration' });
  }
}

/**
 * Log in a user by comparing password and issuing tokens
 */
export async function loginUser(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: 'Email and password are required' });
  }
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error('JWT secrets not defined');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Do not leak which part failed
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Consistent payload shape across the app
    const payload = { userId: user._id.toString(), role: user.role };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRES,
    });

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    return res.json({
      accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isPremium: Boolean(user.isPremium),
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during login' });
  }
}

/**
 * Activate premium status for the user
 */
export async function upgradeToPremium(req, res) {
  try {
    const uid = req.userId || req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isPremium = true;
    await user.save();
    return res.json({ message: 'Premium status activated' });
  } catch (err) {
    console.error('Premium upgrade error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during premium upgrade' });
  }
}

/**
 * Get possible matches with a computed score
 */
export async function getMatchesWithScore(req, res) {
  try {
    const uid = req.userId || req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const currentUser = await User.findById(uid);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const blockedByMe = (currentUser.blockedUsers || []).map(String);
    const interests = currentUser.preferredInterests || [];

    const others = await User.find({ _id: { $ne: currentUser._id } });

    const matches = others
      .filter((u) => {
        const blockedThem = (u.blockedUsers || []).map(String);
        return (
          !blockedByMe.includes(u._id.toString()) &&
          !blockedThem.includes(currentUser._id.toString())
        );
      })
      .map((u) => {
        let score = 0;

        // Gender preference
        if (
          currentUser.preferredGender === 'any' ||
          (u.gender &&
            u.gender.toLowerCase() ===
              String(currentUser.preferredGender || '').toLowerCase())
        ) {
          score += 20;
        }

        // Age range
        if (
          typeof u.age === 'number' &&
          typeof currentUser.preferredMinAge === 'number' &&
          typeof currentUser.preferredMaxAge === 'number' &&
          u.age >= currentUser.preferredMinAge &&
          u.age <= currentUser.preferredMaxAge
        ) {
          score += 20;
        }

        // Interest overlap
        const common = (u.interests || []).filter((i) =>
          (interests || []).includes(i)
        );
        score += Math.min(common.length * 10, 60);

        return {
          id: u._id.toString(),
          username: u.username,
          email: u.email,
          age: u.age,
          gender: u.gender,
          profilePicture: u.profilePicture,
          isPremium: Boolean(u.isPremium),
          matchScore: score,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json(matches);
  } catch (err) {
    console.error('Match score error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during match search' });
  }
}

/**
 * Bulk upload extra photos
 */
export async function uploadExtraPhotos(req, res) {
  try {
    const uid = req.userId || req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const files = req.files || [];
    const maxAllowed = user.isPremium ? 20 : 6;

    if ((user.extraImages?.length || 0) + files.length > maxAllowed) {
      return res
        .status(400)
        .json({ error: `Max ${maxAllowed} images allowed` });
    }

    files.forEach((f) => {
      if (!user.extraImages) user.extraImages = [];
      user.extraImages.push(f.path);
    });

    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadExtraPhotos error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo upload' });
  }
}

/**
 * Upload single photo into a slot
 */
export async function uploadPhotoStep(req, res) {
  try {
    const uid = req.userId || req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const slot = parseInt(req.body?.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (!user.extraImages) user.extraImages = [];

    if (user.extraImages[slot]) removeFile(user.extraImages[slot]);
    user.extraImages[slot] = req.file?.path;

    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadPhotoStep error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo step upload' });
  }
}

/**
 * Delete a specific photo slot
 */
export async function deletePhotoSlot(req, res) {
  try {
    const uid = req.userId || req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const slot = parseInt(req.params?.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (!user.extraImages) user.extraImages = [];

    if (user.extraImages[slot]) {
      removeFile(user.extraImages[slot]);
      user.extraImages[slot] = null;
    }
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('deletePhotoSlot error:', err);
    return res
      .status(500)
      .json({ error: 'Server error during photo deletion' });
  }
}

// --- REPLACE START: export functions ---
export default {
  registerUser,
  loginUser,
  upgradeToPremium,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
};
// --- REPLACE END ---
