// File: server/src/config/corsOptions.js

// --- REPLACE START: centralized CORS config passthrough to corsConfig.js ---
/**
 * Single source of truth for CORS.
 *
 * This file now simply re-exports the centralized CORS middleware from:
 *   server/src/config/corsConfig.js
 *
 * Why:
 * - Avoids having two competing CORS configurations (corsOptions.js vs corsConfig.js)
 * - Prevents accidental drift or duplicated/contradicting settings
 * - Ensures one consistent behavior across the app
 *
 * Notes:
 * - Keep this shim to avoid refactors in files that still import `./config/corsOptions.js`.
 * - All comments are in English as requested.
 * - Do not add manual Access-Control-Allow-* header sets anywhere else; let this middleware handle it.
 */

import corsConfig from './corsConfig.js';

// ESM default export (primary path in apps with "type": "module")
export default corsConfig;

/**
 * Backward compatibility for any CommonJS consumers that may still do:
 *   const corsOptions = require('./config/corsOptions');
 *
 * This keeps the runtime stable without forcing an immediate refactor.
 * If your project is pure ESM, this block is harmless.
 */
/* c8 ignore next 7 */
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module?.exports) {
    // eslint-disable-next-line no-undef
    module.exports = corsConfig;
  }
} catch {
  // Intentionally empty — environment doesn’t support CJS interop (pure ESM runtime).
}

/**
 * IMPORTANT:
 * - If you still find any `app.use(cors(...))` or manual `res.setHeader('Access-Control-Allow-*', ...)`
 *   in the codebase, replace them with:
 *     import corsConfig from '../config/corsConfig.js';
 *     app.use(corsConfig);
 * - Also ensure broad `app.options('*', ...)` handlers do not hardcode CORS headers.
 *   Let the middleware handle preflight responses uniformly.
 */
// --- REPLACE END ---
