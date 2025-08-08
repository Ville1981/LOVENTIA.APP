/*
  Mock Service Worker (MSW) setup in development.
  Replacement regions are marked between:
    // --- REPLACE START …
    // --- REPLACE END
*/

// --- REPLACE START: import setupWorker from 'msw/browser' (not 'msw') ---
import { setupWorker } from 'msw/browser';
// --- REPLACE END ---

// --- REPLACE START: import your handlers ---
import { handlers } from './handlers';
// --- REPLACE END ---

// Create the service worker with provided request handlers
export const worker = setupWorker(...handlers);

// --- REPLACE START: do NOT auto-start here; main.tsx controls .start() ---
/* worker.start() is intentionally invoked from main.tsx */
// --- REPLACE END ---
