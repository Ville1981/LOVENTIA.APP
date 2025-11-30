// PATH: server/src/utils/logger.js

// The replacement region is marked between // --- REPLACE START and
// // --- REPLACE END so you can verify exactly what changed.

// --- REPLACE START: Winston logger with env control + helpers for HTTP logging ---
import winston from "winston";

/**
 * Resolve log level from environment:
 * - LOG_LEVEL wins if set.
 * - In production default is "info".
 * - In non-production default is "debug".
 */
const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

/**
 * Base Winston logger.
 * - Timestamp + stack traces for errors.
 * - JSON output so logs are machine-readable.
 * - Console transport only for now (can be extended later).
 *
 * NOTE:
 * - This logger is designed to match the JSON-style HTTP logs
 *   in server/src/app.js when used like:
 *
 *     logger.info({
 *       scope: "http",
 *       requestId,
 *       method,
 *       url,
 *       statusCode,
 *       latencyMs,
 *       ip,
 *       userId,
 *     });
 */
const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Create a child logger with a fixed "scope" field.
 * Usage example:
 *
 *   const httpLogger = createScopedLogger("http");
 *   httpLogger.info({ requestId, method, url, statusCode, latencyMs, ip, userId });
 *
 * This keeps all logs consistent:
 * - timestamp
 * - level
 * - scope
 * - requestId
 * - method, url, statusCode, latencyMs, ip, userId (when provided)
 */
export function createScopedLogger(scope) {
  const safeScope = scope || "app";
  try {
    if (typeof logger.child === "function") {
      return logger.child({ scope: safeScope });
    }
  } catch {
    // Fallback: return base logger if child creation fails for any reason.
  }
  return logger;
}

/**
 * Helper for HTTP request logs.
 *
 * This matches the fields we already log in app.js:
 * - scope: "http"
 * - requestId
 * - method
 * - url
 * - statusCode
 * - latencyMs
 * - ip
 * - userId (optional)
 *
 * Usage example from a route or middleware:
 *
 *   import logger, { logHttpRequest } from "../utils/logger.js";
 *
 *   const start = process.hrtime.bigint();
 *   // ... handle request ...
 *   const latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
 *   logHttpRequest({
 *     method: req.method,
 *     url: req.originalUrl || req.url,
 *     statusCode: res.statusCode,
 *     latencyMs,
 *     ip: req.ip,
 *     userId: req.userId,
 *   });
 */
export function logHttpRequest({
  level: lvl = "info",
  requestId,
  method,
  url,
  statusCode,
  latencyMs,
  ip,
  userId,
} = {}) {
  const httpLogger = createScopedLogger("http");
  try {
    httpLogger.log({
      level: lvl,
      scope: "http",
      requestId: requestId || undefined,
      method: method || undefined,
      url: url || undefined,
      statusCode: typeof statusCode === "number" ? statusCode : undefined,
      latencyMs:
        typeof latencyMs === "number" && Number.isFinite(latencyMs)
          ? latencyMs
          : undefined,
      ip: ip || undefined,
      userId: userId || undefined,
    });
  } catch {
    // As a last resort, do not throw from logging.
  }
}

/**
 * Default export:
 * - Use this for generic logs (startup, background tasks, etc.).
 * - For HTTP logs, prefer logHttpRequest or a scoped logger.
 */
export default logger;
// --- REPLACE END ---


