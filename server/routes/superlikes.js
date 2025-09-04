// File: server/routes/superlikes.js

// --- REPLACE START: Shim route that delegates to superlike.js (ESM) ---
'use strict';

/**
 * This file keeps backward compatibility if some parts of the app import
 * `/routes/superlikes.js` instead of `/routes/superlike.js`.
 * It simply re-exports the existing Super Like router.
 *
 * Usage in app.js (either works):
 *   import superlikeRoutes from './routes/superlike.js';
 *   app.use('/api/superlike', superlikeRoutes);
 *
 *   // OR (legacy)
 *   import superlikesRoutes from './routes/superlikes.js';
 *   app.use('/api/superlike', superlikesRoutes);
 */

import router from './superlike.js';
export default router;
// --- REPLACE END ---
