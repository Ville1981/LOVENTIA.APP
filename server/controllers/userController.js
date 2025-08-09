// server/controllers/userController.js

// --- REPLACE START: ESM imports (robust CJS/ESM interop for User model) ---
import 'dotenv/config';
// NOTE: The User model is exported via CommonJS (module.exports = UserModel).
// Use a safe interop pattern so this file works in ESM runtime.
import * as UserModule from '../models/User.js';
const User = UserModule.default || UserModule;

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
// --- REPLACE END ---

// Configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

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
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Username, email and password are required' });
  }
  try {
    if (await User.exists({ email })) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    if (await User.exists({ username })) {
      return res.status(400).json({ error: 'Username already taken' });
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
  const { email, password } = req.body;
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const accessToken = jwt.sign(
      // Keep payload shape consistent with the rest of the app/tests
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
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
    const user = await User.findById(req.userId || req.user?.userId);
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
    const currentUser = await User.findById(req.userId || req.user?.userId);
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
        if (
          currentUser.preferredGender === 'any' ||
          (u.gender &&
            u.gender.toLowerCase() ===
              String(currentUser.preferredGender || '').toLowerCase())
        ) {
          score += 20;
        }
        if (
          typeof u.age === 'number' &&
          typeof currentUser.preferredMinAge === 'number' &&
          typeof currentUser.preferredMaxAge === 'number' &&
          u.age >= currentUser.preferredMinAge &&
          u.age <= currentUser.preferredMaxAge
        ) {
          score += 20;
        }
        const common = (u.interests || []).filter((i) => (interests || []).includes(i));
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
    const user = await User.findById(req.userId || req.user?.userId);
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
    files.forEach((f) => user.extraImages.push(f.path));
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
    const user = await User.findById(req.userId || req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const slot = parseInt(req.body.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }
    if (user.extraImages[slot]) removeFile(user.extraImages[slot]);
    user.extraImages[slot] = req.file.path;
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
    const user = await User.findById(req.userId || req.user?.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const slot = parseInt(req.params.slot, 10);
    if (Number.isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }
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
