// server/routes/discover.js

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getDiscover, handleAction } = require('../controllers/discoverController');

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

module.exports = router;
