// PATH: server/src/routes/authRoutes.js

// --- REPLACE START: unified public auth routes (no top-level await; static ESM imports + safe fallbacks) ---
/**

* Public Auth Routes
* ---
* Minimal change: remove ALL top-level dynamic imports and replace with static ESM imports.
* Keep behavior identical where possible and provide light in-file fallbacks (no TLA).
*
* Notes:
* • CORS is centralized via ../config/corsConfig.js (env-driven).
* • If validators or schemas are missing, we fall back to permissive no-ops.
* • /me remains here as a convenience (protected with authenticate), but private-only
* endpoints should live in authPrivateRoutes.js.
  */

import express from 'express';
import corsConfig from '../config/corsConfig.js';

// Controllers (static imports)
import authController from '../api/controllers/authController.js';
import * as userControllerNs from '../controllers/userController.js';

// Middleware (static imports)
import authenticate from '../middleware/authenticate.js';

// Optional validation (static imports; may be partially undefined in some repos)
import { validateBody as _validateBody } from '../middleware/validateRequest.js';

// Load CommonJS validator schemas in an ESM-safe way (no top-level await)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// IMPORTANT: authValidator is CommonJS; ensure we load the .cjs file explicitly.
let authSchemas = null;
try {
// Path is relative to THIS file (server/src/routes)
authSchemas = require('../validators/authValidator.cjs');
} catch {
// If missing, we keep authSchemas = null and skip schema validation gracefully.
}

// Extract optional schemas (may be undefined)
const _loginSchema = authSchemas?.loginSchema;
const _registerSchema = authSchemas?.registerSchema;

const router = express.Router();

// ──────────────────────────────────────────────────────────────────────────────
// Safe fallbacks for optional pieces (no-op if not present)
// ──────────────────────────────────────────────────────────────────────────────
/** If validateBody is unavailable, pass-through middleware. */
const validateBody =
typeof _validateBody === 'function' ? _validateBody : (_schema) => (_req, _res, next) => next();

/** Schemas may be undefined; route handlers will simply skip schema validation in that case. */
const loginSchema = _loginSchema || null;
const registerSchema = _registerSchema || null;

/** Resolve possible namespace/default export from userController. */
const userController =
userControllerNs?.default && typeof userControllerNs.default === 'object'
? userControllerNs.default
: userControllerNs || {};

// Defensive controller object (avoid destructuring undefined)
const authCtrl = authController || {};

// ──────────────────────────────────────────────────────────────────────────────
// CORS note
// ─────────────────────────────────────────────────────────────────────────────-
/**

* Do NOT set Access-Control-* manually here.
* Use centralized `corsConfig` so origin mirrors env (CORS_ORIGINS/CLIENT_URL).
* Add explicit OPTIONS per public endpoint to satisfy preflight.
  */

// ──────────────────────────────────────────────────────────────────────────────
// /login (public)
// ─────────────────────────────────────────────────────────────────────────────-
if (typeof authCtrl.login === 'function') {
router.options('/login', corsConfig, (_req, res) => res.sendStatus(204));
if (loginSchema) {
router.post('/login', corsConfig, validateBody(loginSchema), authCtrl.login);
} else {
router.post('/login', corsConfig, authCtrl.login);
}
}

// ──────────────────────────────────────────────────────────────────────────────
// /register (public)
// ─────────────────────────────────────────────────────────────────────────────-
if (typeof authCtrl.register === 'function') {
router.options('/register', corsConfig, (_req, res) => res.sendStatus(204));
if (registerSchema) {
router.post('/register', corsConfig, validateBody(registerSchema), authCtrl.register);
} else {
router.post('/register', corsConfig, authCtrl.register);
}
}

// ──────────────────────────────────────────────────────────────────────────────
// /refresh (public)
// ─────────────────────────────────────────────────────────────────────────────-
if (typeof authCtrl.refreshToken === 'function') {
router.options('/refresh', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/refresh', corsConfig, authCtrl.refreshToken);
}

// ──────────────────────────────────────────────────────────────────────────────
/** /logout (public) */
// ─────────────────────────────────────────────────────────────────────────────-
if (typeof authCtrl.logout === 'function') {
router.options('/logout', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/logout', corsConfig, authCtrl.logout);
}

// ──────────────────────────────────────────────────────────────────────────────
// /forgot-password (public)
// Prefer controller if available; otherwise provide a safe placeholder.
// ─────────────────────────────────────────────────────────────────────────────-
const forgotHandler =
(typeof authCtrl.forgotPassword === 'function' && authCtrl.forgotPassword) ||
(typeof userController.forgotPassword === 'function' && userController.forgotPassword) ||
(async (req, res) => {
try {
const email = (req.body?.email || '').trim().toLowerCase();
if (!email) return res.status(400).json({ error: 'Email is required.' });
return res.status(200).json({
message: 'If an account exists for that email, a reset link has been sent.',
});
} catch {
return res.status(500).json({ error: 'Failed to process request.' });
}
});

router.options('/forgot-password', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/forgot-password', corsConfig, forgotHandler);

// ──────────────────────────────────────────────────────────────────────────────
// /reset-password (public)
// Prefer controller if available; otherwise respond with clear 400.
// ─────────────────────────────────────────────────────────────────────────────-
const resetHandler =
(typeof authCtrl.resetPassword === 'function' && authCtrl.resetPassword) ||
(typeof userController.resetPassword === 'function' && userController.resetPassword) ||
(async (_req, res) => res.status(400).json({ error: 'Reset-password handler not configured.' }));

router.options('/reset-password', corsConfig, (_req, res) => res.sendStatus(204));
router.post('/reset-password', corsConfig, resetHandler);

// ──────────────────────────────────────────────────────────────────────────────
/**

* GET /me (protected)
* Uses authenticate middleware if available, resolves to authCtrl.me or userController.getMe.
* If neither exists, we simply do not mount /me here (to avoid misleading 200s).
  */
  // ─────────────────────────────────────────────────────────────────────────────-
  const meHandler =
  (typeof authCtrl.me === 'function' && authCtrl.me) ||
  (typeof userController.getMe === 'function' && userController.getMe) ||
  null;

if (meHandler) {
const ensureAuth = (fn) =>
typeof fn === 'function'
? fn
: (_req, res) => res.status(500).json({ error: 'Authenticate middleware not available' });
router.get('/me', ensureAuth(authenticate), meHandler);
}

export default router;
// --- REPLACE END ---


