// --- REPLACE START: private auth routes (only protected /me) ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Load controller (ESM-safe dynamic import)
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
);
const authController = ControllerModule.default || ControllerModule;

// Load authenticate middleware
const AuthMwModule = await import(
  pathToFileURL(path.resolve(__dirname, '../middleware/authenticate.js')).href
);
const authenticate = AuthMwModule.default || AuthMwModule;

/**
 * IMPORTANT:
 * This router must contain ONLY protected auth endpoints.
 * DO NOT put /login, /register, /refresh, /logout here.
 * Those belong to the public auth router.
 */

// Protected "who am I"
if (typeof authController.me === 'function') {
  router.get('/me', authenticate, authController.me);
}

export default router;
// --- REPLACE END ---
