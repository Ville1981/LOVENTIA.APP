// File: server/routes/authPrivate.js

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
).catch(() => null);
const authController = ControllerModule?.default || ControllerModule || {};

// Load authenticate middleware (support default, named, or module export)
const AuthMwModule = await import(
  pathToFileURL(path.resolve(__dirname, '../middleware/authenticate.js')).href
).catch(() => null);
const authenticate =
  AuthMwModule?.default ||
  AuthMwModule?.authenticate ||
  AuthMwModule;

// Guard: ensure we actually have a callable middleware
const ensureAuth = (fn) => {
  if (typeof fn === 'function') return fn;
  // Fallback no-op that rejects requests clearly if middleware could not be loaded
  return (_req, res) => res.status(500).json({ error: 'Authenticate middleware not available' });
};

/**
 * IMPORTANT:
 * This router must contain ONLY protected auth endpoints.
 * DO NOT put /login, /register, /refresh, /logout here.
 * Those belong to the public auth router.
 */

// Protected "who am I"
if (typeof authController.me === 'function') {
  router.get('/me', ensureAuth(authenticate), authController.me);
} else {
  // If controller not available, expose a clear 501 to prevent silent failures
  router.get('/me', (_req, res) =>
    res.status(501).json({ error: 'authController.me is not implemented' })
  );
}

export default router;
// --- REPLACE END ---
