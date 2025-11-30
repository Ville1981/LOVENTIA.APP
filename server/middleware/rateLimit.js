// PATH: server/middleware/rateLimit.js

// --- REPLACE START: ESM shim delegating to src/middleware/rateLimit.js ---
/**
 * Thin ESM shim that forwards all rate limiters to the main implementation
 * under server/src/middleware/rateLimit.js.
 *
 * This ensures that any imports using:
 *   import { loginLimiter } from "./middleware/rateLimit.js";
 * or:
 *   const { loginLimiter } = require("./middleware/rateLimit.js");
 *
 * will all share the same logic and JSON 429 response payloads.
 */

import {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
} from "./src/middleware/rateLimit.js";

// Re-export named limiters for ESM imports.
export {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};

// Default export for compatibility with CJS-style imports.
export default {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};
// --- REPLACE END ---
