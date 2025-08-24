// File: server/routes/payment.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import 'dotenv/config';

import authenticateToken from '../middleware/auth.js';

// Stripe setup
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// PayPal SDK setup
import paypal from '@paypal/checkout-server-sdk';
import Subscription from '../models/Subscription.js';

// PayPal environment based on .env
const payPalEnv =
  process.env.PAYPAL_MODE === 'live'
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

/* **********************************************************************
 * Helpers
 * *********************************************************************/

function getClientUrl() {
  // Where to send users back after Stripe checkout/portal
  return process.env.CLIENT_URL || 'http://localhost:5174';
}

function getPremiumPriceId() {
  // Stripe Price ID for your subscription plan
  const id = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!id) {
    throw new Error('Missing STRIPE_PREMIUM_PRICE_ID in environment');
  }
  return id;
}

/* **********************************************************************
 * NEW: Billing endpoints expected by the frontend
 *  - /api/billing/create-checkout-session
 *  - /api/billing/create-portal-session
 * These keep your older /api/payment/* routes working as well.
 * *********************************************************************/

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for a subscription.
 * Body (optional): { email?: string }
 */
router.post(
  '/billing/create-checkout-session',
  authenticateToken,
  async (req, res) => {
    try {
      const { email } = req.body || {};
      const clientUrl = getClientUrl();

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
        metadata: { userId: req.userId || req.user?.id || '' },
        customer_email: email || undefined, // Stripe will dedupe into a customer
        success_url: `${clientUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/subscription-cancel`,
      });

      return res.json({ url: session.url });
    } catch (err) {
      console.error('create-checkout-session error:', err);
      if (String(err.message || '').includes('STRIPE_PREMIUM_PRICE_ID')) {
        return res.status(501).json({
          error:
            'Billing not configured: missing STRIPE_PREMIUM_PRICE_ID in environment.',
        });
      }
      return res
        .status(500)
        .json({ error: 'Unable to create checkout session' });
    }
  }
);

/**
 * POST /api/billing/create-portal-session
 * Opens Stripe Billing Portal for the current user.
 * Requires a Stripe Customer ID. We try to find one, otherwise respond 501 with a helpful message.
 */
router.post(
  '/billing/create-portal-session',
  authenticateToken,
  async (req, res) => {
    try {
      const clientUrl = getClientUrl();

      // Try to infer a customer ID:
      // 1) from req.user.stripeCustomerId if your auth middleware attaches it
      // 2) from your Subscription model (if you store it)
      // 3) fallback to an env var for testing (STRIPE_TEST_CUSTOMER)
      let customerId =
        req.user?.stripeCustomerId ||
        req.user?.stripe_customer_id ||
        null;

      if (!customerId) {
        // Try to find a Stripe subscription record for this user
        try {
          const sub = await Subscription.findOne({
            user: req.userId || req.user?.id,
            provider: 'stripe',
          })
            .sort({ createdAt: -1 })
            .lean();
          if (sub?.customerId || sub?.customer_id) {
            customerId = sub.customerId || sub.customer_id;
          }
        } catch (e) {
          // ignore lookup errors, we still have one more fallback
        }
      }

      if (!customerId && process.env.STRIPE_TEST_CUSTOMER) {
        customerId = process.env.STRIPE_TEST_CUSTOMER;
      }

      if (!customerId) {
        return res.status(501).json({
          error:
            'No Stripe customer found for this user. Store a stripeCustomerId on the user or Subscription record, or set STRIPE_TEST_CUSTOMER for testing.',
        });
      }

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: clientUrl + '/settings/subscriptions',
      });

      return res.json({ url: portal.url });
    } catch (err) {
      console.error('create-portal-session error:', err);
      return res.status(500).json({ error: 'Unable to open billing portal' });
    }
  }
);

/* **********************************************************************
 * EXISTING ROUTES: preserved for backward compatibility
 * *********************************************************************/

/**
 * POST /api/payment/stripe-session
 * Creates a Stripe Checkout session for subscriptions (legacy path)
 */
router.post('/stripe-session', authenticateToken, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      metadata: { userId: req.userId || req.user?.id || '' },
      success_url: `${getClientUrl()}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getClientUrl()}/subscription-cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

/**
 * POST /api/payment/paypal-order
 * Creates a PayPal order for subscriptions
 */
router.post('/paypal-order', authenticateToken, async (req, res) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.userId || req.user?.id || '',
          amount: {
            currency_code: 'USD',
            value: process.env.PAYPAL_PREMIUM_PRICE || '0.00',
          },
        },
      ],
      application_context: {
        return_url: `${getClientUrl()}/subscription-success-paypal`,
        cancel_url: `${getClientUrl()}/subscription-cancel`,
      },
    });

    const order = await payPalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error('PayPal order error:', err);
    res.status(500).json({ error: 'Unable to create PayPal order' });
  }
});

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
        user: req.userId || req.user?.id,
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
 * NOTE: This route expects raw body; make sure your global bodyParser does not consume it first.
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

    const verifyReq =
      new paypal.notification.WebhookEventVerifySignatureRequest();
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
              user: event.resource?.supplementary_data?.related_ids?.order_id,
              plan: 'premium',
              provider: 'paypal',
              subscriptionId: event.resource?.id,
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
