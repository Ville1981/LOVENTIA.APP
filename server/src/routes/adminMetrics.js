// File: server/src/routes/adminMetrics.js

// --- REPLACE START: /api/admin/metrics route (protected) ---
import express from "express";
import { getSummary } from "../controllers/adminMetricsController.js";
import adminOnly from "../middleware/adminOnly.js";

// NOTE: make sure your global auth middleware populates req.user before this route.
// If you use a separate requireAuth, you can add it here before adminOnly.
const router = express.Router();

router.get("/summary", adminOnly, getSummary);

export default router;
// --- REPLACE END ---
