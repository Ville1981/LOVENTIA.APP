// server/routes/discover.js

// --- REPLACE START: convert CommonJS to ES module imports ---
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getDiscover, handleAction } from '../controllers/discoverController.js';
// --- REPLACE END ---

const router = express.Router();
const validActions = ['pass', 'like', 'superlike'];

// GET /api/discover
router.get('/', getDiscover);

// POST /api/discover/:userId/:actionType
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

// --- REPLACE START: export router as ES module default ---
export default router;
// --- REPLACE END ---
