// File: server/src/routes/paypalWebhook.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
// --- REPLACE START: lazy-load Subscription model ---
let Subscription = null;
async function getSubscriptionModel() {
  if (Subscription) return Subscription;
  try {
    const mod = await import('../models/Subscription.js');
    Subscription = mod.default || mod.Subscription || mod;
  } catch (e) {
    Subscription = null;
  }
  return Subscription;
}
// --- REPLACE END ---
import paypal from '@paypal/checkout-server-sdk';
import 'dotenv/config';

const router = express.Router();

// Configure PayPal environment
const payPalEnv = process.env.PAYPAL_MODE === 'live'
  ? new paypal.core.LiveEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_SECRET
    )
  : new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_SECRET
    );

const payPalClient = new paypal.core.PayPalHttpClient(payPalEnv);
// --- REPLACE END ---

/**
 * POST /api/payment/paypal-webhook
 * Handles PayPal webhook events with signature verification
 *
 * NOTE:
 * This router is mounted in app.js at: app.use('/api/payment/paypal-webhook', router)
 * Therefore the path here must be '/'.
 * This route is mounted AFTER JSON body parsers; raw body is not required for PayPal.
 */
router.post(
  '/',
  async (req, res) => {
    try {
      if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET || !process.env.PAYPAL_WEBHOOK_ID) {
        console.error('[paypal-webhook] Missing PAYPAL_* environment variables.');
        return res.status(500).send('PayPal webhook is not configured on the server.');
      }

      const transmissionId  = req.headers['paypal-transmission-id'];
      const transmissionTime= req.headers['paypal-transmission-time'];
      const certUrl         = req.headers['paypal-cert-url'];
      const authAlgo        = req.headers['paypal-auth-algo'];
      const transmissionSig = req.headers['paypal-transmission-sig'];
      const webhookId       = process.env.PAYPAL_WEBHOOK_ID;

      // Support both Buffer (if raw was ever applied upstream) and parsed object
      const isBufferBody = Buffer.isBuffer(req.body);
      const bodyString   = isBufferBody ? req.body.toString('utf8') : JSON.stringify(req.body || {});
      const eventObject  = isBufferBody ? JSON.parse(bodyString) : (req.body || {});

      // Build verification request
      const verifyReq = new paypal.notification.WebhookEventVerifySignatureRequest();
      verifyReq.requestBody({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: eventObject,
      });

      const response = await payPalClient.execute(verifyReq);
      const status   = response?.result?.verification_status;

      if (status !== 'SUCCESS') {
        console.error('[paypal-webhook] Verification failed:', response?.result);
        return res.sendStatus(400);
      }

      const event = eventObject;
      console.log('[paypal-webhook] Verified event:', event?.event_type);

      // Process event types
      switch (event?.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const orderId = event?.resource?.supplementary_data?.related_ids?.order_id;
          const captureId = event?.resource?.id;

          try {
            const _Sub = await getSubscriptionModel(); if (_Sub && _Sub.create) await _Sub.create({
              user: orderId || 'unknown_user',
              plan: 'premium',
              provider: 'paypal',
              subscriptionId: captureId || 'unknown_capture',
            });
          } catch (e) {
            // Do not fail the webhook due to persistence errors; just log
            console.error('[paypal-webhook] Failed to persist subscription:', e?.message || e);
          }
          break;
        }

        case 'PAYMENT.CAPTURE.DENIED': {
          console.warn('[paypal-webhook] PAYMENT.CAPTURE.DENIED:', event?.resource?.id);
          break;
        }

        // Add more handlers as needed:
        // - BILLING.SUBSCRIPTION.ACTIVATED
        // - BILLING.SUBSCRIPTION.CANCELLED
        // - PAYMENT.SALE.COMPLETED
        default: {
          console.log(`[paypal-webhook] Unhandled event: ${event?.event_type}`);
        }
      }

      // Acknowledge receipt
      return res.sendStatus(200);
    } catch (err) {
      console.error('[paypal-webhook] Error handling webhook:', err?.message || err);
      // Return 200 to avoid repeated retries if the failure is not due to validation
      return res.sendStatus(200);
    }
  }
);

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
