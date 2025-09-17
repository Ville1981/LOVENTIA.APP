// routes/moderation.js

// --- REPLACE START: switch to ESM import for express ---
import express from "express";
// --- REPLACE END ---
const authenticate = require('../middleware/authenticate');
// Optional: import an isAdmin middleware if you have one
// const isAdmin = require('../middleware/isAdmin');

const {
  reportMessage,
  getPendingReports,
  resolveReport,
} = require('../controllers/moderationController');

const router = express.Router();

// Parse JSON bodies
router.use(express.json());

/**
 * POST /api/moderation/report
 * Allows authenticated users to report a message.
 */
router.post(
  '/report',
  authenticate,
  // --- REPLACE START: apply rate limit and profanity filter if desired ---
  // const { moderationRateLimiter, profanityFilter } = require('../middleware/moderation');
  // moderationRateLimiter,
  // profanityFilter,
  // --- REPLACE END ---
  reportMessage
);

/**
 * GET /api/moderation/pending
 * Returns all pending reports. Protected: admin only.
 */
router.get(
  '/pending',
  authenticate,
  // --- REPLACE START: enforce admin authorization ---
  // isAdmin,
  // --- REPLACE END ---
  getPendingReports
);

/**
 * POST /api/moderation/resolve
 * Body: { reportId: string, action: 'approve'|'reject' }
 * Protected: admin only.
 */
router.post(
  '/resolve',
  authenticate,
  // --- REPLACE START: enforce admin authorization ---
  // isAdmin,
  // --- REPLACE END ---
  resolveReport
);

// --- REPLACE START: export router as CommonJS module ---
// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---
// --- REPLACE END ---
