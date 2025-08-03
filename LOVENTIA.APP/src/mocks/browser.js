// File: src/mocks/browser.js

// Import MSW setupWorker from browser package
import { setupWorker } from 'msw/browser';

// --- REPLACE START: correct import for handlers ---
// Import named handlers array from handlers.js
import { handlers } from './handlers';
// --- REPLACE END ---

// Initialize and export the MSW worker with the handlers
export const worker = setupWorker(...handlers);
