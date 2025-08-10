// --- REPLACE START: private authentication routes (with authenticate middleware) ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import authenticate from '../middleware/authenticate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import of controller for Windows + ESM compatibility
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
);
const authController = ControllerModule.default || ControllerModule;

const router = express.Router();

/**
 * GET /api/auth/me
 * Requires Authorization: Bearer <accessToken>
 * Responds with { user: {...} } (password omitted).
 */
router.get('/me', authenticate, authController.me);

export default router;
// --- REPLACE END ---
