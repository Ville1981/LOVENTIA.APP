// PATH: server/src/middleware/error.js

// --- REPLACE START ---
import logger from "../utils/logger.js";

/**
 * 404 handler – keep response simple and JSON.
 * The structured HTTP log is already handled by requestLogger middleware,
 * so we do not log separately here to avoid duplicate lines.
 */
export const notFound = (req, res, next) => {
  res.status(404).json({ error: "Not Found" });
};

/**
 * Central error handler.
 *
 * Responsibilities:
 *  - Determine status code (err.status / err.statusCode / 500).
 *  - Build a stable JSON payload for the client.
 *  - Log a structured error line via logger.js, including:
 *      requestId, userId, method, path, statusCode, name, message, stack.
 *
 * Response behavior:
 *  - In production: no stack in the JSON payload.
 *  - In non-production: include stack to help debugging.
 *
 * Logging:
 *  - Always logs stack to logger (if present), but wraps in try/catch so
 *    logging failures never break the HTTP response.
 */
export const errorHandler = (err, req, res, next) => {
  const code = err.status || err.statusCode || 500;

  const payload = {
    error: err.message || "Server Error",
  };

  // Only expose stack to clients in non-production environments
  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stack = err.stack;
  }

  // Structured logging; never let logging errors break the response
  try {
    const requestId =
      req.requestId || (res.locals && res.locals.requestId) || null;
    const user = req.user || {};
    const userId = req.userId || user.id || user._id || null;
    const path = req.originalUrl || req.url || "";
    const method = req.method || "";

    logger.error({
      scope: "error",
      requestId,
      userId,
      method,
      path,
      statusCode: code,
      name: err.name || "Error",
      message: err.message || "Server Error",
      // Log stack for diagnostics even in production; payload already hides it there
      stack: err.stack,
    });
  } catch {
    // If logging fails for some reason, we still want to send the HTTP response.
  }

  res.status(code).json(payload);
};
// --- REPLACE END ---
