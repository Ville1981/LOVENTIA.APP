// File: server/src/routes/users.js

// --- REPLACE START: thin alias that default-exports the same router as userRoutes.js (ESM default) ---
/**
 * Purpose:
 * - Some bootstraps look specifically for `server/src/routes/users.js` when mounting `/api/users`.
 * - This file simply re-exports the router implemented in `./userRoutes.js`.
 * - Keep this alias small and explicit to avoid accidental duplication of logic.
 */
import router from "./userRoutes.js";

export default router;
// --- REPLACE END ---
