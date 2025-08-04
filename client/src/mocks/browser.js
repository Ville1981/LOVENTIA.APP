// File: src/mocks/browser.js

// --- REPLACE START: import setupWorker from MSW core package ---
import { setupWorker } from 'msw';
// --- REPLACE END ---

// --- REPLACE START: import your handlers ---
import { handlers } from './handlers';
// --- REPLACE END ---

// Initialize and export the MSW worker with your handlers
export const worker = setupWorker(...handlers);
