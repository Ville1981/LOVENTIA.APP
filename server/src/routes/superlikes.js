// PATH: server/src/routes/superlikes.js

// --- REPLACE START: Minimal shim re-export for the plural base (/api/superlikes) ---
'use strict';

/**
 * This file simply re-exports the unified Superlike router used for the
 * singular base (/api/superlike). Mount both bases to support:
 *
 *   app.use('/api/superlike',  authenticate, router);
 *   app.use('/api/superlikes', authenticate, router);
 *
 * No local identifiers are declared here to avoid ESLint "already declared"
 * and circular self-import issues.
 */

export { default } from './superlike.js';
// --- REPLACE END ---
