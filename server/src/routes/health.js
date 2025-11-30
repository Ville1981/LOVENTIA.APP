// PATH: server/src/routes/health.js

// --- REPLACE START: ESM health route (no DB calls, JSON payload with ok/uptime/version/timestamp) ---
import { Router } from "express";

const router = Router();
const BOOT_TIME_MS = Date.now();

/**
 * Liveness probe.
 * - No DB calls
 * - No auth
 * - Lightweight JSON payload
 *
 * Recommended mount:
 *   app.use("/health", healthRouter);
 *
 * This complements:
 *   - GET /health (text "OK") in app.js
 *   - /ready and /metrics diagnostics in app.js
 */
router.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    uptime: Number(process.uptime().toFixed(3)), // seconds
    version: process.env.npm_package_version ?? "0.0.0-dev",
    timestamp: new Date().toISOString(),
    startedAt: new Date(BOOT_TIME_MS).toISOString(),
  });
});

// Ultra-light checks
router.head("/", (_req, res) => res.sendStatus(200));
router.options("/", (_req, res) => res.sendStatus(204));

export default router;
// --- REPLACE END ---
