// routes/authRoutes.js

import { Router } from 'express';
import {
  login,
  refreshToken,
  logout,
} from '../controllers/authController.js';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/refresh
router.post('/refresh', refreshToken);

// POST /api/auth/logout
router.post('/logout', logout);

export default router;
