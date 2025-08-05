/*
  This file sets up the Mock Service Worker (MSW) in development.
  Replacement regions are marked between:
    // --- REPLACE START …
    // --- REPLACE END
  so you can verify exactly what changed.
*/

// --- REPLACE START: import setupWorker and http from MSW as top‐level ESM export ---
import { setupWorker } from 'msw/browser';
import { http } from 'msw';
// --- REPLACE END ---

// --- REPLACE START: import your request handlers ---
import { handlers } from './handlers';
// --- REPLACE END ---

// Initialize and export the MSW worker with your handlers
export const worker = setupWorker(...handlers);

// --- REPLACE START: note on `rest` re-export removed ---
// Handlers should import `http` directly from 'msw' instead of `rest`.
// --- REPLACE END ---
