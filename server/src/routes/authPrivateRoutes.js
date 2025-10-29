// PATH: server/src/routes/authPrivateRoutes.js

// --- REPLACE START: private auth routes (no top-level await; static ESM imports) ---
/**
 * Private Auth Routes
 * -------------------
 * Contains ONLY protected endpoints (e.g., /me).
 * Public endpoints like /login, /register, /refresh, /logout must live in the public auth router.
 *
 * Change summary (minimal & safe):
 *  • Removed top-level dynamic `await import(...)` to eliminate "unsettled top-level await" warnings.
 *  • Switched to static ESM imports for controller and middleware.
 *  • Kept route logic and guard behavior intact.
 */

import express from 'express';
import authController from '../api/controllers/authController.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

/**
 * Guard: ensure we actually have a callable middleware.
 * If for some reason the imported middleware is not a function, respond clearly.
 */
const ensureAuth = (fn) => {
  if (typeof fn === 'function') return fn;
  // Fallback no-op that rejects requests clearly if middleware could not be loaded
  return (_req, res) => res.status(500).json({ error: 'Authenticate middleware not available' });
};

/**
 * Protected "who am I"
 * Uses the imported authenticate middleware. Requires that authController.me exists.
 * If controller is missing, expose a clear 501 to prevent silent failures.
 */
if (authController && typeof authController.me === 'function') {
  router.get('/me', ensureAuth(authenticate), authController.me);
} else {
  router.get('/me', (_req, res) =>
    res.status(501).json({ error: 'authController.me is not implemented' })
  );
}

export default router;
// --- REPLACE END ---


