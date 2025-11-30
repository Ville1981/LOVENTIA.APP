// File: server/src/routes/reportRoutes.js
// Routes for passive abuse/safety reports.

import express from "express";
import authenticate from "../middleware/authenticate.js";
import { createReport, listMyReports } from "../controllers/reportController.js";

const router = express.Router();

// POST /api/reports
router.post("/", authenticate, createReport);

// GET /api/reports/mine
router.get("/mine", authenticate, listMyReports);

export default router;
