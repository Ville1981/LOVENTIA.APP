import express from 'express';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Korjattu dynaaminen importti Windows-ESM yhteensopivaksi ---
const ControllerModule = await import(
  pathToFileURL(path.resolve(__dirname, '../api/controllers/authController.js')).href
);
const authController = ControllerModule.default || ControllerModule;

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
    // ei schemoja
  }
} catch {
  // ei validatoria
}

const router = express.Router();

if (validateBody && loginSchema) {
  router.post('/login', validateBody(loginSchema), authController.login);
} else {
  router.post('/login', authController.login);
}

if (typeof authController.register === 'function') {
  if (validateBody && registerSchema) {
    router.post('/register', validateBody(registerSchema), authController.register);
  } else {
    router.post('/register', authController.register);
  }
}

if (typeof authController.refreshToken === 'function') {
  router.post('/refresh', authController.refreshToken);
}

if (typeof authController.logout === 'function') {
  router.post('/logout', authController.logout);
}

export default router;
