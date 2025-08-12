// --- REPLACE START: ensure register/login use unified cookieOptions + proper JWT secrets ---
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cookieOptions } = require('../config/cookie'); // centralized cookie settings

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

/**
 * Register a new user
 */
async function registerUser(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email, password: hashed });

    const { _id, name: userName, email: userEmail } = user;
    return res.status(201).json({ user: { id: _id, name: userName, email: userEmail } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

/**
 * Login user and set refresh token cookie
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const payload = { id: user._id, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // HttpOnly refresh token cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    const { _id, name, email: userEmail, role } = user;
    return res.json({ accessToken, user: { id: _id, name, email: userEmail, role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

module.exports = { registerUser, loginUser };
// --- REPLACE END ---
