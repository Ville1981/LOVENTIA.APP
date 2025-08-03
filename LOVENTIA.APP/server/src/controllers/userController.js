// File: src/controllers/userController.js

// Controller for user registration and login, issuing JWT tokens and setting refresh cookie

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cookieOptions } = require('../config/cookie'); // import cookie configuration

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

/**
 * Register a new user: hash password, save user, and return basic profile
 */
async function registerUser(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user document
    const user = await User.create({
      name,
      email,
      password: hashed,
    });

    // Return created user (omit password)
    const { _id, name: userName, email: userEmail } = user;
    return res.status(201).json({ user: { id: _id, name: userName, email: userEmail } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

/**
 * Login existing user: validate credentials, issue tokens, set refresh cookie, return access token and user info
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate tokens
    const payload = { id: user._id, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Set refresh token as HttpOnly cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Return accessToken and user profile
    const { _id, name, email: userEmail, role } = user;
    return res.json({ accessToken, user: { id: _id, name, email: userEmail, role } });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

// --- REPLACE START: export only registerUser and loginUser ---
module.exports = { registerUser, loginUser };
// --- REPLACE END ---
