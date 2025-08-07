// server/routes/paypalWebhook.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import Subscription from '../models/Subscription.js';
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
 */
router.post(
  '/paypal/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const body = req.body.toString();

    // Build verification request
    const verifyReq = new paypal.notification.WebhookEventVerifySignatureRequest();
    verifyReq.requestBody({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    });

    try {
      const response = await payPalClient.execute(verifyReq);
      if (response.result.verification_status === 'SUCCESS') {
        const event = JSON.parse(body);
        console.log('Verified PayPal webhook event:', event.event_type);

        // Process event types
        switch (event.event_type) {
          case 'PAYMENT.CAPTURE.COMPLETED':
            await Subscription.create({
              user: event.resource.supplementary_data.related_ids.order_id,
              plan: 'premium',
              provider: 'paypal',
              subscriptionId: event.resource.id,
            });
            break;
          case 'PAYMENT.CAPTURE.DENIED':
            console.warn('PayPal payment denied:', event.resource);
            break;
          default:
            console.log(`Unhandled PayPal event: ${event.event_type}`);
        }

        return res.sendStatus(200);
      } else {
        console.error('PayPal webhook verification failed:', response.result);
        return res.sendStatus(400);
      }
    } catch (err) {
      console.error('Error handling PayPal webhook:', err);
      return res.sendStatus(500);
    }
  }
);

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
