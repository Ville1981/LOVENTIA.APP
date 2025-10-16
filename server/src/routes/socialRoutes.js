// server/src/routes/socialRoutes.js
// --- REPLACE START: convert to ESM and proxy to ./social.js ---
//
// Rationale:
// This file previously used CommonJS (`require`) inside an ESM project,
// causing `ERR_AMBIGUOUS_MODULE_SYNTAX`. To keep behavior identical and
// avoid duplicating logic, we make this a thin ESM pass-through to the
// canonical router defined in ./social.js.
//
// Guarantees:
// - No duplicated endpoints (single source of truth in ./social.js)
// - Same mount path(s) as before via routes/index.js
// - Clean ESM semantics without require()
//
import socialRouter from './social.js';

export default socialRouter;
// --- REPLACE END ---
