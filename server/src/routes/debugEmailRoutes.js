// PATH: server/src/routes/debugEmailRoutes.js
// --- REPLACE START: Debug email routes (email-log + test-event) ---
import { Router } from "express";
import {
  getEmailLog,
  clearEmailLog,
  logEmailEvent,
} from "../utils/emailService.js";

const router = Router();

/**
 * GET /api/debug/email-log?limit=5
 *
 * Palauttaa viimeisimmät transactional-email -tapahtumat muistista.
 */
router.get("/email-log", (req, res) => {
  try {
    const rawLimit = req.query.limit;
    let limit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = 20; // default
    }

    const log = getEmailLog(limit);

    return res.status(200).json({
      ok: true,
      count: Array.isArray(log) ? log.length : 0,
      log: Array.isArray(log) ? log : [],
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[debugEmailRoutes] /email-log error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Unable to read email log" });
  }
});

/**
 * POST /api/debug/email-log/clear
 *
 * Tyhjentää muistissa olevan email-logi-listan.
 */
router.post("/email-log/clear", (req, res) => {
  try {
    clearEmailLog();
    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[debugEmailRoutes] /email-log/clear error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Unable to clear email log" });
  }
});

/**
 * POST /api/debug/email-log/test-event
 *
 * Lisää yhden feikkitapahtuman logiin (ei oikeaa email-lähetystä).
 */
router.post("/email-log/test-event", (req, res) => {
  try {
    const now = new Date();

    logEmailEvent({
      type: "debug:test-event",
      to: "debug@local",
      subject: "Debug email log test (no send)",
      template: "debug/test-event",
      status: "simulated",
      meta: {
        source: "/api/debug/email-log/test-event",
        at: now.toISOString(),
      },
      createdAt: now,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[debugEmailRoutes] /email-log/test-event error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Unable to append test event" });
  }
});

export default router;
// --- REPLACE END ---


