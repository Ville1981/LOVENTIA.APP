const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerUser, loginUser } = require('../controllers/userController');
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/authMiddleware');

// ----------------------- 🔄 REFRESH TOKEN REITTI -----------------------
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// ----------------------- 🔐 LOGOUT -----------------------
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
    domain: req.hostname,
  });
  return res.json({ message: 'Logout successful' });
});

// ----------------------- 🆕 REGISTER -----------------------
router.post('/register', registerUser);

// ----------------------- 🔑 LOGIN -----------------------
router.post('/login', loginUser);

// ----------------------- 👤 GET CURRENT USER -----------------------
router.get('/me', authenticate, async (req, res) => {
  try {
    // authenticate-middleware asettaa req.user.id:ksi käyttäjän id:n
    const user = await User.findById(req.user.id).select('_id email role');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Muotoillaan vaste: id, email ja role
    return res.json({
      id: user._id,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error('Fetch /me error:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ----------------------- 🖼️ UPDATE PROFILE -----------------------
router.put(
  '/profile',
  authenticate,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'extraImages', maxCount: 6 },
  ]),
  async (req, res) => {
    try {
      const updateData = {
        name: req.body.name,
        email: req.body.email,
        age: req.body.age,
        height: req.body.height,
        weight: req.body.weight,
        status: req.body.status,
        religion: req.body.religion,
        children: req.body.children,
        pets: req.body.pets,
        summary: req.body.summary,
        goal: req.body.goal,
        lookingFor: req.body.lookingFor,
      };

      if (req.files['image']) {
        updateData.profilePicture = `uploads/${req.files['image'][0].filename}`;
      }
      if (req.files['extraImages']) {
        updateData.extraImages = req.files['extraImages'].map(
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

// ----------------------- 🗑️ DELETE ACCOUNT -----------------------
router.delete('/delete', authenticate, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    return res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return res.status(500).json({ error: 'Account deletion failed' });
  }
});

module.exports = router;
