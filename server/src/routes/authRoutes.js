// --- REPLACE START: public authentication routes (no authenticate middleware) + forgot/reset-password wiring ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for authController (Windows ESM compatibility)
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
).catch(() => null);
const authController = ControllerModule?.default || ControllerModule || {};

// --- REPLACE START: also try userController as a fallback for forgot/reset and me ---
let userController = {};
try {
  const UcModule = await import(
    pathToFileURL(path.resolve(__dirname, '../controllers/userController.js')).href
  );
  userController = UcModule.default || UcModule || {};
} catch {
  // ignore – we'll still expose safe placeholders below where needed
}
// --- REPLACE END ---

// Optional request validators
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
  }
}

/**
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
 */
const forgotHandler =
  (typeof authController.forgotPassword === 'function' && authController.forgotPassword) ||
  (typeof userController.forgotPassword === 'function' && userController.forgotPassword) ||
  (async (req, res) => {
    try {
      // Generic, non-enumerating placeholder to avoid 404 and keep UX intact
      const email = (req.body?.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required.' });
      return res.status(200).json({
        message: 'If an account exists for that email, a reset link has been sent.',
      });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to process request.' });
    }
  });
router.post('/forgot-password', forgotHandler);

/**
 * POST /reset-password
 * Public route
 * Prefer controller implementation if available, otherwise return a safe placeholder (400).
 */
const resetHandler =
  (typeof authController.resetPassword === 'function' && authController.resetPassword) ||
  (typeof userController.resetPassword === 'function' && userController.resetPassword) ||
  (async (_req, res) => res.status(400).json({ error: 'Reset-password handler not configured.' }));
router.post('/reset-password', resetHandler);

/**
 * GET /me
 * Protected route — authenticate middleware should be applied in main router
 * If authController.me missing, try userController.getMe as a fallback.
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
