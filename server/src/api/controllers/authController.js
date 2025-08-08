// File: server/src/api/controllers/authController.js

// --- REPLACE START: CommonJS controller with inline JWT flow and safe path resolution ---
'use strict';

const path = require('path');
const jwt = require('jsonwebtoken');

// cookieOptions sijaitsee src-puolella -> suhteessa tähän tiedostoon
const { cookieOptions } = require(path.resolve(__dirname, '../../utils/cookieOptions.js'));

// User-malli sijaitsee server/models/User.js (EI src-kansiossa)
const User = require(path.resolve(__dirname, '../../../models/User.js'));

/**
 * POST /api/auth/login
 * Authenticate user and set refreshToken cookie.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate credentials against your user model
    const user = await User.findByCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Access token (short-lived)
    const accessToken = jwt.sign(
      { userId: user.id || user._id?.toString?.(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Refresh token (httpOnly cookie)
    const refreshToken = jwt.sign(
      { userId: user.id || user._id?.toString?.(), role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie with centralized options
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.json({
      accessToken,
      user: {
        id: user.id || user._id?.toString?.(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Verify refreshToken cookie and issue new accessToken.
 */
async function refreshToken(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // New access token
      const newAccessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Optional rotation: extend session by re-setting refresh cookie
      try {
        const rotatedRefresh = jwt.sign(
          { userId: payload.userId, role: payload.role },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
        res.cookie('refreshToken', rotatedRefresh, cookieOptions);
      } catch (_) {
        // Rotation failure shouldn't block access token issuance
      }

      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/logout
 * Clear refreshToken cookie.
 */
function logout(req, res) {
  res.clearCookie('refreshToken', cookieOptions);
  return res.sendStatus(204);
}

module.exports = {
  login,
  refreshToken,
  logout,
};
// --- REPLACE END ---
