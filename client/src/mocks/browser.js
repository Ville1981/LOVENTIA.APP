// File: src/mocks/browser.js
// --- REPLACE START: correct import for setupWorker ---
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
// --- REPLACE END ---

export const worker = setupWorker(...handlers);
