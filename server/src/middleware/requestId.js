// PATH: server/src/middleware/requestId.js

// --- REPLACE START ---
import requestLogger from "./requestLogger.js";

/**
 * Backward-compatible shim for legacy requestId middleware.
 *
 * Historically this middleware was responsible for:
 *  - generating a requestId
 *  - attaching it to req.requestId / res.locals.requestId
 *  - setting the X-Request-Id response header
 *
 * We now delegate this responsibility to the unified requestLogger middleware,
 * which also measures latency and logs a structured JSON line via logger.js.
 *
 * Any existing imports that still call `requestId()` will now receive the
 * requestLogger middleware instead. This keeps behavior aligned while avoiding
 * duplicate implementations of requestId logic.
 */
export default function requestId() {
  // Delegate directly to the new requestLogger middleware.
  // NOTE: If both requestId() and requestLogger() are mounted in app.js,
  // the request will be logged twice. Prefer mounting only one of them.
  return requestLogger();
}
// --- REPLACE END ---
