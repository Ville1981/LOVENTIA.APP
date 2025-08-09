// File: server/src/routes/authRoutes.js

// --- REPLACE START: CommonJS auth routes wired to controller (no ESM) ---
'use strict';

const path = require('path');
const express = require('express');
const router = express.Router();

// Import controller via safe absolute path from src/
const authController = require(path.resolve(__dirname, '../api/controllers/authController.js'));

// Optional validators (only if app-level middleware isn't already validating)
let validateBody, loginSchema, registerSchema;
try {
  ({ validateBody } = require(path.resolve(__dirname, '../../middleware/validateRequest.js')));
  ({ loginSchema, registerSchema } = require(path.resolve(__dirname, '../validators/authValidator.js')));
} catch (_) {
  // Validators are optional; if not present, routes still work.
}

// Login
if (validateBody && loginSchema) {
  router.post('/login', validateBody(loginSchema), authController.login);
} else {
  router.post('/login', authController.login);
}

// Register (only if controller exposes it)
if (typeof authController.register === 'function') {
  if (validateBody && registerSchema) {
    router.post('/register', validateBody(registerSchema), authController.register);
  } else {
    router.post('/register', authController.register);
  }
}

// Refresh token
if (typeof authController.refreshToken === 'function') {
  router.post('/refresh', authController.refreshToken);
}

// Logout
if (typeof authController.logout === 'function') {
  router.post('/logout', authController.logout);
}

module.exports = router;
// --- REPLACE END ---
