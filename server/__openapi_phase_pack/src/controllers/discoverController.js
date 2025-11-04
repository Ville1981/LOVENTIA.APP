// File: server/src/controllers/discoverController.js
// --- REPLACE START: SHIM that forwards to the real controller and exposes a default handler ---
/**
 * Shim to forward imports from src/controllers/discoverController.js
 * to the real controller in server/controllers/discoverController.js.
 *
 * Why this shape?
 * - Our router expects a *default export function* for GET /api/discover.
 * - The real controller exports named functions { getDiscover, handleAction }.
 * - To keep both worlds happy, we:
 *    1) import the named functions,
 *    2) re-export them for direct named usage, and
 *    3) set `export default` to `getDiscover` so dynamic imports can call it directly.
 *
 * All comments in English as requested. No unnecessary shortening.
 */

'use strict';

// Import everything from the real controller (works whether CJS/ESM under transpilers)
import * as RealController from '../../controllers/discoverController.js';

// Pull out handlers (defensive in case file shape changes)
export const getDiscover = RealController.getDiscover || RealController.default || (() => {
  throw new Error('[discoverController shim] getDiscover is not exported from ../../controllers/discoverController.js');
});
export const handleAction = RealController.handleAction || (async () => {
  throw new Error('[discoverController shim] handleAction is not exported from ../../controllers/discoverController.js');
});

// Default export MUST be the GET handler so routers using `mod.default` work.
export default getDiscover;

// Also re-export everything else for completeness (no duplication risk)
export * from '../../controllers/discoverController.js';

// --- REPLACE END ---
