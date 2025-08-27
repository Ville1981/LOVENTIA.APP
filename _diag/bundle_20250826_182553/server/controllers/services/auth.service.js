// --- REPLACE START: auth service (register/login, full logic, fixed model path) ---
import 'dotenv/config';
import * as UserModule from '../../src/models/User.js';
const User = UserModule.default || UserModule;

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * Service: register a new user (keeps full validation + hashing)
 */
export async function registerUserService(req, res) {
  const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;

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
 * Service: login user (keeps full token issuance + cookie set)
 */
export async function loginUserService(req, res, { refreshCookieOptions }) {
  const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
  const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

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

    // Set refresh token cookie (centralized options)
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
// --- REPLACE END ---
