// File: server/src/routes/authRoutes.js

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
 */
if (validateBody && loginSchema) {
  router.post('/login', validateBody(loginSchema), authController.login);
} else {
  router.post('/login', authController.login);
}

/**
 * POST /register
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
 * Also respond to OPTIONS for CORS preflight
 */
if (typeof authController.refreshToken === 'function') {
  router.options('/refresh', (_req, res) => res.sendStatus(204)); // preflight OK
  router.post('/refresh', authController.refreshToken);
}

/**
 * POST /logout
 */
if (typeof authController.logout === 'function') {
  router.post('/logout', authController.logout);
}

export default router;
// --- REPLACE END ---

