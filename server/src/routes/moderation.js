// --- REPLACE START: conflict markers resolved (kept incoming side) ---

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


const router = express.Router();

// Parse JSON bodies
router.use(express.json());

/**
 * POST /api/moderation/report
 * Allows authenticated users to report a message.
 */
router.post(

  "/report",
  authenticate,
  // --- REPLACE START: apply rate limit and profanity filter if desired ---
  // import { moderationRateLimiter, profanityFilter } from "../middleware/moderation.js";

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

  "/pending",

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

  "/resolve",

  authenticate,
  // --- REPLACE START: enforce admin authorization ---
  // isAdmin,
  // --- REPLACE END ---
  resolveReport
);


// --- REPLACE START: switch to ESM default export ---
export default router;
// --- REPLACE END ---



// --- REPLACE END ---
