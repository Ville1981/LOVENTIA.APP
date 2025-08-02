// server/controllers/userController.js

// Load environment variables
require('dotenv').config();

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

/**
 * Utility: remove a file from disk
 */
function removeFile(filePath) {
  if (!filePath) return;
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error(`Failed to remove file ${filePath}:`, err);
  }
}

/**
 * Register a new user with hashed password
 */
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    if (await User.findOne({ username })) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

/**
 * Log in a user by comparing password and issuing tokens
 */
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Basic request validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Ensure secrets are defined
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error('JWT secret(s) not defined in environment');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
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
        id: user._id,
        username: user.username,
        email: user.email,
        isPremium: user.isPremium,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

/**
 * Activate premium status for the user
 */
const upgradeToPremium = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isPremium = true;
    await user.save();
    return res.json({ message: 'Premium status activated' });
  } catch (err) {
    console.error('Premium upgrade error:', err);
    return res.status(500).json({ error: 'Server error during premium upgrade' });
  }
};

/**
 * Get possible matches with a computed score
 */
const getMatchesWithScore = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const blockedByMe = Array.isArray(currentUser.blockedUsers)
      ? currentUser.blockedUsers.map((id) => id.toString())
      : [];
    const interests = Array.isArray(currentUser.preferredInterests)
      ? currentUser.preferredInterests
      : [];
    const allUsers = await User.find({ _id: { $ne: currentUser._id } });
    const matches = allUsers
      .filter((u) => {
        const blockedThem = Array.isArray(u.blockedUsers)
          ? u.blockedUsers.map((id) => id.toString())
          : [];
        return (
          !blockedByMe.includes(u._id.toString()) &&
          !blockedThem.includes(currentUser._id.toString())
        );
      })
      .map((u) => {
        let score = 0;
        if (
          currentUser.preferredGender === 'any' ||
          (u.gender && u.gender.toLowerCase() === currentUser.preferredGender.toLowerCase())
        ) {
          score += 20;
        }
        if (u.age >= currentUser.preferredMinAge && u.age <= currentUser.preferredMaxAge) {
          score += 20;
        }
        const common = interests.filter((i) => u.interests.includes(i));
        score += Math.min(common.length * 10, 60);
        return {
          id: u._id,
          username: u.username,
          email: u.email,
          age: u.age,
          gender: u.gender,
          profilePicture: u.profilePicture,
          isPremium: u.isPremium,
          matchScore: score,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
    return res.json(matches);
  } catch (err) {
    console.error('Match score error:', err);
    return res.status(500).json({ error: 'Server error during match search' });
  }
};

/**
 * Bulk upload extra photos
 */
const uploadExtraPhotos = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const files = req.files;
    if (!Array.isArray(files) || !files.length) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    const maxAllowed = user.isPremium ? 20 : 6;
    const existingCount = user.extraImages.filter(Boolean).length;
    if (existingCount + files.length > maxAllowed) {
      return res.status(400).json({ error: `Max ${maxAllowed} images allowed` });
    }
    files.forEach((f) => user.extraImages.push(f.path));
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadExtraPhotos error:', err);
    return res.status(500).json({ error: 'Server error during photo upload' });
  }
};

/**
 * Upload single photo into a slot
 */
const uploadPhotoStep = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const slot = parseInt(req.body.slot, 10);
    if (isNaN(slot) || slot < 0) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    if (user.extraImages[slot]) {
      removeFile(user.extraImages[slot]);
    }
    user.extraImages[slot] = req.file.path;
    await user.save();
    return res.json({ extraImages: user.extraImages });
  } catch (err) {
    console.error('uploadPhotoStep error:', err);
    return res.status(500).json({ error: 'Server error during photo step upload' });
  }
};

/**
 * Delete a specific photo slot
 */
const deletePhotoSlot = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const slot = parseInt(req.params.slot, 10);
    if (isNaN(slot) || slot < 0) {
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
    return res.status(500).json({ error: 'Server error during photo deletion' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  upgradeToPremium,
  getMatchesWithScore,
  uploadExtraPhotos,
  uploadPhotoStep,
  deletePhotoSlot,
};
