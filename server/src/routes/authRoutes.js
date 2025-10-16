<<<<<<< HEAD
// File: server/src/routes/authRoutes.js

// --- REPLACE START: public authentication routes (no authenticate middleware) + forgot/reset-password wiring ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
=======
// PATH: server/src/routes/authRoutes.js

// --- REPLACE START: public auth routes with centralized CORS + explicit preflights ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import corsConfig from '../config/corsConfig.js'; // dynamic origin via env (supports 5173 & 5174 etc.)
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

<<<<<<< HEAD
// Dynamic import for authController (Windows ESM compatibility)
// From server/src/routes → ../api/controllers resolves to server/src/api/controllers
=======
// Dynamic import for authController (Windows ESM compatible)
// From server/src/routes → ../api/controllers → server/src/api/controllers
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
).catch(() => null);
const authController = ControllerModule?.default || ControllerModule || {};

<<<<<<< HEAD
// --- REPLACE START: also try userController as a fallback for forgot/reset and me ---
let userController = {};
try {
  // From server/src/routes → ../controllers resolves to server/src/controllers
=======
// Also try userController as a fallback for forgot/reset and me
let userController = {};
try {
  // From server/src/routes → ../controllers → server/src/controllers
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
  const UcModule = await import(
    pathToFileURL(path.resolve(__dirname, '../controllers/userController.js')).href
  );
  userController = UcModule.default || UcModule || {};
} catch {
<<<<<<< HEAD
  // ignore – we'll still expose safe placeholders below where needed
}
// --- REPLACE END ---
=======
  // ignore – we still expose safe placeholders where needed below
}
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466

// Optional request validators (if present)
let validateBody, loginSchema, registerSchema;
try {
  const validators = await import(
    pathToFileURL(path.resolve(__dirname, '../middleware/validateRequest.js')).href
  );
  validateBody = validators.validateBody;

  try {
    const schemas = await import(
      pathToFileURL(path.resolve(__dirname, '../api/validators/authValidator.js')).href
    );
    loginSchema = schemas.loginSchema;
    registerSchema = schemas.registerSchema;
  } catch {
    // No schemas found — skip schema validation
  }
} catch {
  // No validator found — skip request validation
}

const router = express.Router();

/**
<<<<<<< HEAD
 * POST /login
 * Public route
 */
if (validateBody && loginSchema && typeof authController.login === 'function') {
  router.post('/login', validateBody(loginSchema), authController.login);
} else if (typeof authController.login === 'function') {
  router.post('/login', authController.login);
}

/**
 * POST /register
 * Public route
 */
if (typeof authController.register === 'function') {
  if (validateBody && registerSchema) {
    router.post('/register', validateBody(registerSchema), authController.register);
  } else {
    router.post('/register', authController.register);
=======
 * NOTE ABOUT CORS:
 * - Do NOT set Access-Control-* manually here.
 * - Use centralized `corsConfig` so origin mirrors env (CORS_ORIGINS/CLIENT_URL).
 * - Add explicit OPTIONS per public endpoint to satisfy preflight.
 */

/**
 * POST /login  (public)
 * + OPTIONS /login (preflight)
 */
if (typeof authController.login === 'function') {
  router.options('/login', corsConfig, (_req, res) => res.sendStatus(204));
  if (validateBody && loginSchema) {
    router.post('/login', corsConfig, validateBody(loginSchema), authController.login);
  } else {
    router.post('/login', corsConfig, authController.login);
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
  }
}

/**
<<<<<<< HEAD
 * POST /refresh
 * Public route
 * Also respond to OPTIONS for CORS preflight
 */
if (typeof authController.refreshToken === 'function') {
  router.options('/refresh', (_req, res) => res.sendStatus(204)); // preflight OK
  router.post('/refresh', authController.refreshToken);
}

/**
 * POST /logout
 * Public route
 * Also respond to OPTIONS for CORS preflight
 */
if (typeof authController.logout === 'function') {
  router.options('/logout', (_req, res) => res.sendStatus(204)); // preflight OK
  router.post('/logout', authController.logout);
}

/**
 * POST /forgot-password
 * Public route
 * Prefer controller implementation if available, otherwise return a safe placeholder.
=======
 * POST /register  (public)
 * + OPTIONS /register (preflight)
 */
if (typeof authController.register === 'function') {
  router.options('/register', corsConfig, (_req, res) => res.sendStatus(204));
  if (validateBody && registerSchema) {
    router.post('/register', corsConfig, validateBody(registerSchema), authController.register);
  } else {
    router.post('/register', corsConfig, authController.register);
  }
}

/**
 * POST /refresh  (public)
 * + OPTIONS /refresh (preflight)
 */
if (typeof authController.refreshToken === 'function') {
  router.options('/refresh', corsConfig, (_req, res) => res.sendStatus(204));
  router.post('/refresh', corsConfig, authController.refreshToken);
}

/**
 * POST /logout  (public)
 * + OPTIONS /logout (preflight)
 */
if (typeof authController.logout === 'function') {
  router.options('/logout', corsConfig, (_req, res) => res.sendStatus(204));
  router.post('/logout', corsConfig, authController.logout);
}

/**
 * POST /forgot-password  (public)
 * Prefer controller implementation if available, otherwise a safe placeholder.
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
 */
const forgotHandler =
  (typeof authController.forgotPassword === 'function' && authController.forgotPassword) ||
  (typeof userController.forgotPassword === 'function' && userController.forgotPassword) ||
  (async (req, res) => {
    try {
<<<<<<< HEAD
      // Generic, non-enumerating placeholder to avoid 404 and keep UX intact
=======
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
      const email = (req.body?.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required.' });
      return res.status(200).json({
        message: 'If an account exists for that email, a reset link has been sent.',
      });
<<<<<<< HEAD
    } catch (e) {
      return res.status(500).json({ error: 'Failed to process request.' });
    }
  });
router.post('/forgot-password', forgotHandler);

/**
 * POST /reset-password
 * Public route
 * Prefer controller implementation if available, otherwise return a safe placeholder (400).
=======
    } catch {
      return res.status(500).json({ error: 'Failed to process request.' });
    }
  });
router.options('/forgot-password', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/forgot-password', corsConfig, forgotHandler);

/**
 * POST /reset-password  (public)
 * Prefer controller implementation if available, otherwise a safe 400.
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
 */
const resetHandler =
  (typeof authController.resetPassword === 'function' && authController.resetPassword) ||
  (typeof userController.resetPassword === 'function' && userController.resetPassword) ||
  (async (_req, res) => res.status(400).json({ error: 'Reset-password handler not configured.' }));
<<<<<<< HEAD
router.post('/reset-password', resetHandler);

/**
 * GET /me
 * Protected route — authenticate middleware should be applied in main router
 * If authController.me missing, try userController.getMe as a fallback.
=======
router.options('/reset-password', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/reset-password', corsConfig, resetHandler);

/**
 * GET /me  (protected)
 * authenticate middleware is attached if available.
 * If authController.me missing, try userController.getMe.
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
 */
const meHandler =
  (typeof authController.me === 'function' && authController.me) ||
  (typeof userController.getMe === 'function' && userController.getMe);

if (meHandler) {
  try {
    const maybeAuth = await import(
      pathToFileURL(path.resolve(__dirname, '../middleware/authenticate.js')).href
    );
    const authenticate = maybeAuth.default || maybeAuth.authenticate || maybeAuth;
    router.get('/me', authenticate, meHandler);
  } catch (err) {
    console.warn('[authRoutes] Could not attach /me route — missing authenticate middleware:', err?.message);
  }
}

export default router;
// --- REPLACE END ---
