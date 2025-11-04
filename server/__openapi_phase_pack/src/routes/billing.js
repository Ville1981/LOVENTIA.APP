// File: server/src/routes/billing.js
// Shim: map /api/billing → /api/payment router
// Purpose: keep compatibility after consolidating billing logic into payment.js

// --- REPLACE START: delegate cleanly to payment.js (only one default export) ---
import router from "./payment.js";
export default router;
// --- REPLACE END ---
