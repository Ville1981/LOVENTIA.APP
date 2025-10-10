// File: server/src/routes/adminRoutes.js

// --- REPLACE START: protected admin routes (metrics + stripe) ---
import express from 'express';
import { getMetrics, getStripeRevenue } from '../controllers/adminController.js';
import requireAdmin from '../middleware/requireAdmin.js';
// Assumes an upstream auth middleware populates req.user (e.g., verifyJWT)

const router = express.Router();

router.get('/metrics', requireAdmin, getMetrics);
router.get('/stripe/revenue', requireAdmin, getStripeRevenue);

export default router;
// --- REPLACE END ---
