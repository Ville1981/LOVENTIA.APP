// server/routes/payment.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import authenticateToken from '../middleware/auth.js';
import 'dotenv/config';

// Stripe setup
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PayPal SDK setup
import paypal from '@paypal/checkout-server-sdk';
import Subscription from '../models/Subscription.js';


// PayPal environment based on .env
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

const router = express.Router();

/**
 * POST /api/payment/stripe-session
 * Creates a Stripe Checkout session for subscriptions
 */
router.post(
  '/stripe-session',
  authenticateToken,
  async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
        metadata: { userId: req.userId },
        success_url: `${process.env.CLIENT_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/subscription-cancel`,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error('Stripe session error:', err);
      res.status(500).json({ error: 'Unable to create checkout session' });
    }
  }
);

/**
 * POST /api/payment/paypal-order
 * Creates a PayPal order for subscriptions
 */
router.post(
  '/paypal-order',
  authenticateToken,
  async (req, res) => {
    try {
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: req.userId,
          amount: { currency_code: 'USD', value: process.env.PAYPAL_PREMIUM_PRICE },
        }],
        application_context: {
          return_url: `${process.env.CLIENT_URL}/subscription-success-paypal`,
          cancel_url: `${process.env.CLIENT_URL}/subscription-cancel`,
        },
      });

      const order = await payPalClient.execute(request);
      res.json({ id: order.result.id });
    } catch (err) {
      console.error('PayPal order error:', err);
      res.status(500).json({ error: 'Unable to create PayPal order' });
    }
  }
);

/**
 * POST /api/payment/paypal-capture
 * Captures a PayPal order and records subscription
 */
router.post(
  '/paypal-capture',
  authenticateToken,
  express.json(),
  async (req, res) => {
    try {
      const { orderID } = req.body;
      const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID);
      captureRequest.requestBody({});

      const capture = await payPalClient.execute(captureRequest);
      await Subscription.create({
        user: req.userId,
        plan: 'premium',
        provider: 'paypal',
        subscriptionId: capture.result.id,
      });
      res.json({ status: capture.result.status, details: capture.result });
    } catch (err) {
      console.error('PayPal capture error:', err);
      res.status(500).json({ error: 'Unable to capture PayPal order' });
    }
  }
);

/**
 * POST /api/payment/paypal-webhook
 * Handles PayPal webhook events
 */
router.post(
  '/paypal-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const body = req.body.toString();

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
        res.sendStatus(200);
      } else {
        console.error('PayPal webhook verification failed:', response.result);
        res.sendStatus(400);
      }
    } catch (err) {
      console.error('Error handling PayPal webhook:', err);
      res.sendStatus(500);
    }
  }
);

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
