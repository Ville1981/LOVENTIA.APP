// PATH: server/src/routes/authRoutes.js
// CLEAN A-VERSION — minimal, stable, single-source auth router
// @ts-nocheck

import express from "express";
import { loginLimiter } from "../middleware/rateLimit.js";

/**
 * 🧠 Uusi rakenne:
 * - Ei enää mitään omia reittejä (ei register, login, reset, verify…)
 * - Ei fallbackeja
 * - Ei shadowausta
 * - Ei tuplamountteja
 *
 * Tämä tiedosto toimii vain:
 *   1) loginLimiter → POST /login
 *   2) delegoi koko auth-logiikan → realAuthRouter
 */

import realAuthRouter from "../../routes/auth.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*  LOGIN LIMITER ONLY                                                        */
/* -------------------------------------------------------------------------- */

router.use("/login", (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "POST") return next();
  return loginLimiter(req, res, next);
});

/* -------------------------------------------------------------------------- */
/*  DELEGATE EVERYTHING TO REAL AUTH ROUTER                                   */
/* -------------------------------------------------------------------------- */

router.use("/", realAuthRouter);

console.log("[authRoutes(src)] CLEAN A-version mounted (delegation only)");

export default router;












