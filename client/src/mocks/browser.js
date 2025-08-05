/*
  This file sets up the Mock Service Worker (MSW) in development.
  Replacement regions are marked between:
    // --- REPLACE START …
    // --- REPLACE END
  so you can verify exactly what changed.
*/

// --- REPLACE START: import setupWorker and rest from MSW as top‐level ESM export ---
import { setupWorker } from 'msw/browser';
import { rest } from 'msw';
// --- REPLACE END ---

// --- REPLACE START: import your request handlers ---
import { handlers } from './handlers';
// --- REPLACE END ---

// Initialize and export the MSW worker with your handlers
export const worker = setupWorker(...handlers);

// --- REPLACE START: re-export rest so it can be imported from here ---
/*
  Removed re-export of `rest` here.
  Handlers should import `rest` directly from 'msw'.
*/
// --- REPLACE END ---
