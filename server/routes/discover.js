// server/routes/discover.js

// --- REPLACE START: ES module route compatible with "type": "module" ---
import express from 'express';

// Auth middleware (ESM/CJS interop safe)
import * as AuthenticateModule from '../middleware/authenticate.js';
const authenticateToken = AuthenticateModule.default || AuthenticateModule;

// Controllers (supports both named and default exports)
import * as DiscoverCtrlModule from '../controllers/discoverController.js';
const ctrl = DiscoverCtrlModule.default || DiscoverCtrlModule;

const getDiscover =
  typeof ctrl.getDiscover === 'function'
    ? ctrl.getDiscover
    : null;

const handleAction =
  typeof ctrl.handleAction === 'function'
    ? ctrl.handleAction
    : null;

if (typeof getDiscover !== 'function' || typeof handleAction !== 'function') {
  throw new Error("discoverController.js must export 'getDiscover' and 'handleAction'");
}
// --- REPLACE END ---

const router = express.Router();
const validActions = ['pass', 'like', 'superlike'];

// --- REPLACE START: normalize req.userId for controller compatibility ---
function normalizeUserId(req, _res, next) {
  if (!req.userId && req?.user) {
    const maybeId =
      req.user.userId ||
      req.user.id ||
      req.user._id ||
      (req.user._doc && req.user._doc._id) ||
      null;

    req.userId =
      typeof maybeId === 'object' &&
      maybeId !== null &&
      typeof maybeId.toString === 'function'
        ? maybeId.toString()
        : (maybeId || null);
  }
  next();
}
// --- REPLACE END ---

// GET /api/discover (protected)
// Returns profiles based on query filters; excludes current user unless ?includeSelf=1
// --- REPLACE START: apply authentication + normalization ---
router.get('/', authenticateToken, normalizeUserId, getDiscover);
// --- REPLACE END ---

// POST /api/discover/:userId/:actionType (protected)
// Records an action (pass/like/superlike) from current user towards :userId
router.post(
  '/:userId/:actionType',
  authenticateToken,
  normalizeUserId,
  (req, res, next) => {
    const { actionType } = req.params;
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: 'Invalid action type' });
    }
    next();
  },
  handleAction
);

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
