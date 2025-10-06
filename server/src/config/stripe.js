// File: server/src/config/stripe.js
// Shim: re-export the centralized Stripe client config and helpers

// --- REPLACE START: re-export stripe client + billingUrls ---
export { default, billingUrls } from '../../config/stripe.js';
// --- REPLACE END ---
