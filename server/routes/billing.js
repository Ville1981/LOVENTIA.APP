// File: server/routes/billing.js
// Thin shim to keep index.js compatibility after consolidating into payment.js

// --- REPLACE START: delegate to payment.js (default export) ---
export { default } from './payment.js';
// --- REPLACE END ---
