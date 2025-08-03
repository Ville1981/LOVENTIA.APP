// server/routes/discover.js

// --- REPLACE START: ES modules & default authenticateToken import ---
import express from 'express';
import authenticateToken from '../middleware/auth.js';
import { getDiscover, handleAction } from '../controllers/discoverController.js';
// --- REPLACE END ---

const router = express.Router();
const validActions = ['pass', 'like', 'superlike'];

// GET /api/discover (protected)
// --- REPLACE START: apply authentication middleware ---
router.get('/', authenticateToken, getDiscover);
// --- REPLACE END ---

// POST /api/discover/:userId/:actionType (protected)
router.post(
  '/:userId/:actionType',
  authenticateToken,
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
