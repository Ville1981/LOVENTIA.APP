<<<<<<< HEAD
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
=======
// server/src/routes/moderation.js

// --- REPLACE START: switch to ESM imports (remove require) ---
import express from "express";
import authenticate from "../middleware/authenticate.js";
// Optional: import an isAdmin middleware if you have one
// import isAdmin from "../middleware/isAdmin.js";

import {
  reportMessage,
  getPendingReports,
  resolveReport,
} from "../controllers/moderationController.js";
// --- REPLACE END ---
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466

const router = express.Router();

// Parse JSON bodies
router.use(express.json());

/**
 * POST /api/moderation/report
 * Allows authenticated users to report a message.
 */
router.post(
<<<<<<< HEAD
  '/report',
  authenticate,
  // --- REPLACE START: apply rate limit and profanity filter if desired ---
  // const { moderationRateLimiter, profanityFilter } = require('../middleware/moderation');
=======
  "/report",
  authenticate,
  // --- REPLACE START: apply rate limit and profanity filter if desired ---
  // import { moderationRateLimiter, profanityFilter } from "../middleware/moderation.js";
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
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
<<<<<<< HEAD
  '/pending',
=======
  "/pending",
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
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
<<<<<<< HEAD
  '/resolve',
=======
  "/resolve",
>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
  authenticate,
  // --- REPLACE START: enforce admin authorization ---
  // isAdmin,
  // --- REPLACE END ---
  resolveReport
);

<<<<<<< HEAD
// --- REPLACE START: export router as CommonJS module ---
// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---
// --- REPLACE END ---
=======
// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---

>>>>>>> 7c16647faa28a92e621c9de1cf05c57fcaf11466
