// --- REPLACE START: forward shim to the full Stripe webhook router ---
/**
 * This file is a thin shim so app.js can always mount `/webhooks`
 * while the full implementation lives in `server/src/routes/stripeWebhook.js`.
 *
 * Result:
 *   app.use('/webhooks', router)  -> handled by routes/stripeWebhook.js
 */
import router from '../routes/stripeWebhook.js';
export default router;
// --- REPLACE END ---
