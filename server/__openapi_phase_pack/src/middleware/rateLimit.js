// PATH: server/__openapi_phase_pack/src/middleware/rateLimit.js

// --- REPLACE START: ESM shim delegating to main src/middleware/rateLimit.js ---
/**
 * Thin ESM shim used by the OpenAPI phase pack.
 * Delegates all rate limiter implementations to:
 *   server/src/middleware/rateLimit.js
 *
 * This keeps the behavior identical across:
 * - runtime server code
 * - OpenAPI tooling / phase pack
 */

import {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
} from "../../../src/middleware/rateLimit.js";

// Re-export named limiters for direct ESM imports.
export {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};

// Default export for compatibility with bundle/namespace-style imports.
export default {
  apiBurstLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  billingLimiter,
  messagesLimiter,
};
// --- REPLACE END ---

