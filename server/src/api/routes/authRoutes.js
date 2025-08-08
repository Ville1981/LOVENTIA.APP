// File: server/src/routes/authRoutes.js

import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
} from '../controllers/authController.js';

const router = Router();

// --- REPLACE START: define auth routes clearly with proper HTTP verbs ---
// Login route - authenticates user and issues tokens
router.post('/login', login);

// Refresh route - validates refresh token and returns new access token
router.post('/refresh', refreshToken);

// Logout route - clears refresh token cookie
router.post('/logout', logout);
// --- REPLACE END ---

export default router;
