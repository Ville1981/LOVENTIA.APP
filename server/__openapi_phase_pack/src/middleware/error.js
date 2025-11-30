// PATH: server/__openapi_phase_pack/src/middleware/error.js

// --- REPLACE START ---
// Shim: reuse the real middleware implementation from server/src/middleware/error.js
// This keeps the OpenAPI phase pack in sync without duplicating logic.

import { notFound, errorHandler } from "../../../src/middleware/error.js";

export { notFound, errorHandler };
// --- REPLACE END ---
