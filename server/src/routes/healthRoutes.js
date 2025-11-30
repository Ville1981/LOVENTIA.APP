// PATH: server/src/routes/healthRoutes.js

// --- REPLACE START: health & readiness routes ---
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

const startedAt = new Date();

/**
 * Extended diagnostics routes.
 *
 * Recommended mount (example):
 *   app.use("/api", healthRoutes);
 *
 * This will expose:
 *   GET /api/healthz
 *   GET /api/readiness
 *
 * These endpoints are slightly heavier than /health because they
 * can touch Mongo and environment variables.
 */

router.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "loventia-server",
    startedAt: startedAt.toISOString(),
    now: new Date().toISOString(),
    version: process.env.APP_VERSION || process.env.GIT_SHA || "dev",
  });
});

router.get("/readiness", async (_req, res) => {
  // Check critical dependencies (Mongo connection + core env variables)
  const mongoOk = mongoose.connection?.readyState === 1; // 1 = connected
  const envOk = !!process.env.JWT_SECRET && !!process.env.MONGO_URI;

  const ok = mongoOk && envOk;
  res.status(ok ? 200 : 503).json({
    ok,
    checks: {
      mongo: mongoOk ? "ok" : "down",
      env: envOk ? "ok" : "missing",
    },
    ts: new Date().toISOString(),
  });
});

export default router;
// --- REPLACE END ---
