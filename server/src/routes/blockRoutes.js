// PATH: server/src/routes/blockRoutes.js

// --- REPLACE START: Block routes (ESM) ---

import express from "express";
import authenticate from "../middleware/authenticate.js";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/blockController.js";

const router = express.Router();

// All block routes require authentication
router.use(authenticate);

// GET /api/block
router.get("/", getBlockedUsers);

// POST /api/block/:id
router.post("/:id", express.json(), blockUser);

// DELETE /api/block/:id
router.delete("/:id", unblockUser);

export default router;

// --- REPLACE END ---
