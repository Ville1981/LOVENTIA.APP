// src/mocks/browser.js
import { setupWorker } from 'msw';
import { handlers } from './handlers';

// --- REPLACE START: export your MSW worker instance ---
export const worker = setupWorker(...handlers);
// --- REPLACE END
