// server/src/routes/referralRoutes.js
// --- REPLACE START: convert to ESM and proxy to ./referral.js ---
//
// Rationale:
// This file was mixing CommonJS (`require`) inside an ESM project, which
// caused `ERR_AMBIGUOUS_MODULE_SYNTAX`. To avoid duplicating logic and to
// keep the exact same route surface, we make this module a thin ESM
// pass-through that re-exports the already ESM-compatible referral router.
//
// This guarantees:
// - No duplicated endpoints (one source of truth in ./referral.js)
// - No path changes (mount points remain exactly as before in index.js)
// - Clean ESM semantics without require()
//
import referralRouter from './referral.js';

export default referralRouter;
// --- REPLACE END ---
