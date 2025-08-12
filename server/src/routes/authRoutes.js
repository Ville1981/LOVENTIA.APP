// --- REPLACE START: public authentication routes (no authenticate middleware) ---
import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for authController (Windows ESM compatibility)
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
);
const authController = ControllerModule.default || ControllerModule;

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
if (validateBody && loginSchema) {
  router.post('/login', validateBody(loginSchema), authController.login);
} else {
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
 */
if (typeof authController.logout === 'function') {
  router.post('/logout', authController.logout);
}

/**
 * GET /me
 * Protected route — authenticate middleware should be applied in main router
 */
if (typeof authController.me === 'function') {
  try {
    const { default: authenticate } = await import(
      pathToFileURL(path.resolve(__dirname, '../middleware/authenticate.js')).href
    );
    router.get('/me', authenticate, authController.me);
  } catch (err) {
    console.warn('[authRoutes] Could not attach /me route — missing authenticate middleware:', err?.message);
  }
}

export default router;
// --- REPLACE END ---
