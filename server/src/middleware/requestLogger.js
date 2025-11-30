// PATH: server/src/middleware/requestLogger.js
// @ts-nocheck

// The replacement region is marked between // --- REPLACE START and
// // --- REPLACE END so you can verify exactly what changed.

// --- REPLACE START: HTTP request logger middleware ---
import { randomUUID as nodeRandomUUID } from "crypto";
import logger, { logHttpRequest, createScopedLogger } from "../utils/logger.js";

/**
 * Safe UUID generator:
 * - Prefers crypto.randomUUID (Node 16+)
 * - Falls back to a simple timestamp-based id if needed.
 */
function generateRequestId() {
  try {
    if (typeof nodeRandomUUID === "function") {
      return nodeRandomUUID();
    }
  } catch {
    // ignore and fall back
  }
  try {
    const rnd = Math.random().toString(16).slice(2, 10);
    return `req-${Date.now().toString(16)}-${rnd}`;
  } catch {
    return `req-${Date.now()}`;
  }
}

/**
 * Get high-resolution start time.
 * Uses process.hrtime.bigint() when available; falls back to Date.now().
 */
function getStartTime() {
  try {
    if (typeof process !== "undefined" && typeof process.hrtime === "function" && typeof process.hrtime.bigint === "function") {
      return process.hrtime.bigint();
    }
  } catch {
    // ignore
  }
  return Date.now();
}

/**
 * Compute latency in milliseconds from a start time.
 * Handles both bigint (hrtime) and number (Date.now()).
 */
function computeLatencyMs(start) {
  try {
    if (typeof start === "bigint") {
      const diff = process.hrtime.bigint() - start;
      return Number(diff) / 1e6;
    }
  } catch {
    // ignore
  }
  if (typeof start === "number") {
    return Date.now() - start;
  }
  return undefined;
}

// Pre-created scoped logger for generic messages from this middleware
const httpLogger = createScopedLogger("http");

/**
 * Express middleware:
 * - Ensures each request has a requestId:
 *   - Reuses incoming X-Request-Id header if present.
 *   - Otherwise generates a new ID.
 * - Measures latencyMs.
 * - Logs a single JSON line on response "finish":
 *   {
 *     timestamp,
 *     level,
 *     scope: "http",
 *     requestId,
 *     method,
 *     url,
 *     statusCode,
 *     latencyMs,
 *     ip,
 *     userId?
 *   }
 * - Attaches requestId to:
 *   - req.requestId
 *   - res.locals.requestId
 */
function requestLogger(req, res, next) {
  // Reuse incoming request id if provided, otherwise generate
  const incomingId =
    (req.headers && (req.headers["x-request-id"] || req.headers["X-Request-Id"])) || undefined;
  const requestId = typeof incomingId === "string" && incomingId.trim() !== ""
    ? incomingId.trim()
    : generateRequestId();

  // Attach to request/response so other middlewares/controllers can use it
  req.requestId = requestId;
  if (!res.locals) {
    res.locals = {};
  }
  res.locals.requestId = requestId;

  const startTime = getStartTime();

  // Define the handler once so we can remove it from both events
  const done = () => {
    try {
      // Important: remove listeners to avoid memory leaks if both events fire
      res.removeListener("finish", done);
      res.removeListener("close", done);
    } catch {
      // ignore
    }

    const latencyMs = computeLatencyMs(startTime);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || undefined;
    const userId = req.userId || (req.user && (req.user.id || req.user._id)) || undefined;

    // Use the helper so logs stay consistent with other places in the app
    logHttpRequest({
      requestId,
      method,
      url,
      statusCode,
      latencyMs,
      ip,
      userId,
    });
  };

  // Log when response has finished or connection is closed
  res.on("finish", done);
  res.on("close", done);

  // Optional debug in very verbose mode
  if (logger && typeof logger.debug === "function" && process.env.LOG_HTTP_REQUEST_IDS === "1") {
    try {
      httpLogger.debug({
        message: "Incoming request",
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
      });
    } catch {
      // ignore
    }
  }

  return next();
}

export default requestLogger;
// --- REPLACE END ---
