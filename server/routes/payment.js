// File: server/routes/payment.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import 'dotenv/config';

// Use the same auth middleware module name used elsewhere in the app
import authenticate from '../middleware/authenticate.js';

// Stripe setup
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Keep pinned so behavior is stable across environments
  apiVersion: '2025-04-30.basil',
  // --- REPLACE START: improve network resiliency (retries + timeout) ---
  maxNetworkRetries: 2,
  timeout: 20000,
  // --- REPLACE END ---
});

// PayPal SDK setup
import paypal from '@paypal/checkout-server-sdk';
import Subscription from '../models/Subscription.js';

// --- REPLACE START: add User model for fallbacks and /sync ---
import User from '../models/User.js';
// --- REPLACE END ---

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

function assertStripeKey() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error('Missing STRIPE_SECRET_KEY in environment.');
    err.code = 'NO_STRIPE_KEY';
    throw err;
  }
}

/**
 * Cancel a subscription by id. Supports both `.cancel` (new SDKs) and `.del` (legacy).
 */
async function cancelStripeSubscriptionById(subId) {
  try {
    if (typeof stripe.subscriptions.cancel === 'function') {
      return await stripe.subscriptions.cancel(subId);
    }
    // fallback – older SDKs
    if (typeof stripe.subscriptions.del === 'function') {
      return await stripe.subscriptions.del(subId);
    }
    throw new Error('stripe.subscriptions.cancel is not a function and .del unavailable');
  } catch (e) {
    // Re-throw to be handled by caller
    throw e;
  }
}

/* **********************************************************************
 * NEW: Billing endpoints expected by the frontend
 *  - POST /api/billing/create-checkout-session
 *  - POST /api/billing/create-portal-session
 *  - POST /api/billing/cancel-now
 * These keep your older /api/payment/* routes working as well.
 *
 * ✅ IMPORTANT ALIGNMENT:
 * Since index.js mounts this router at `/api/billing` and `/api/payment`,
 * the paths here MUST be **without** the extra `/billing` prefix.
 * e.g. app.use('/api/billing', router) + router.post('/create-portal-session')
 *      → final URL: /api/billing/create-portal-session
 * *********************************************************************/

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for a subscription.
 * Body (optional): { email?: string, customerId?: string }
 */
router.post(
  '/create-checkout-session',
  authenticate,
  async (req, res) => {
    try {
      assertStripeKey();
      const { email, customerId: bodyCustomerId } = req.body || {};
      const clientUrl = getClientUrl();

      // Resolve existing customer to avoid creating duplicate Stripe customers
      const uid = req.userId || req.user?._id || req.user?.id || null;

      // Resolution order for customer id:
      // 1) explicit body.customerId
      // 2) req.user.stripeCustomerId
      // 3) User document
      // 4) Subscription(provider='stripe') latest
      let resolvedCustomerId =
        bodyCustomerId ||
        req.user?.stripeCustomerId ||
        req.user?.stripe_customer_id ||
        null;

      if (!resolvedCustomerId && uid) {
        try {
          const u = await User.findById(uid)
            .select('stripeCustomerId stripe_customer_id')
            .lean();
          if (u?.stripeCustomerId || u?.stripe_customer_id) {
            resolvedCustomerId = u.stripeCustomerId || u.stripe_customer_id;
          }
        } catch (_) {}
      }

      if (!resolvedCustomerId && uid) {
        try {
          const sub = await Subscription.findOne({ user: uid, provider: 'stripe' })
            .sort({ createdAt: -1 })
            .lean();
          if (sub?.customerId || sub?.customer_id) {
            resolvedCustomerId = sub.customerId || sub.customer_id;
          }
        } catch (_) {}
      }
      // Do NOT fall back to STRIPE_TEST_CUSTOMER here; if none, let Stripe create a new real customer for this user.

      // --- REPLACE START: build params so ONLY ONE of {customer | customer_email} is sent ---
      const params = {
        mode: 'subscription',
        payment_method_types: ['card'], // Stripe may enable additional methods per account config
        line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
        metadata: {
          userId: uid || '',
          username: req.user?.username || '',
        },
        success_url: `${clientUrl}/settings/subscriptions?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/settings/subscriptions?canceled=1`,
      };

      if (resolvedCustomerId) {
        // Prefer existing Stripe customer if available
        params.customer = resolvedCustomerId;
      } else if (email) {
        // Otherwise prefill with email; Stripe will create/attach a new customer
        params.customer_email = email;
      }
      // --- REPLACE END ---

      const session = await stripe.checkout.sessions.create(params);

      return res.json({ url: session.url });
    } catch (err) {
      console.error('create-checkout-session error:', err);
      if (err.code === 'NO_STRIPE_KEY' || String(err.message || '').includes('STRIPE_PREMIUM_PRICE_ID')) {
        return res.status(501).json({
          error:
            'Billing not configured: ensure STRIPE_SECRET_KEY and STRIPE_PREMIUM_PRICE_ID are set in environment.',
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
  '/create-portal-session',
  authenticate,
  async (req, res) => {
    try {
      assertStripeKey();
      const clientUrl = getClientUrl();

      // --- REPLACE START: accept body.customerId and add User fallback ---
      const uid = req.userId || req.user?.id || req.user?._id || null;

      // Try to infer a customer ID from several sources
      let customerId =
        req.body?.customerId ||               // allow explicit body value
        req.user?.stripeCustomerId ||
        req.user?.stripe_customer_id ||
        null;

      if (!customerId) {
        // Try to find a Stripe subscription record for this user
        try {
          const sub = await Subscription.findOne({
            user: uid,
            provider: 'stripe',
          })
            .sort({ createdAt: -1 })
            .lean();
          if (sub?.customerId || sub?.customer_id) {
            customerId = sub.customerId || sub.customer_id;
          }
        } catch (e) {
          // ignore lookup errors, we still have more fallbacks
        }
      }

      if (!customerId && uid) {
        // User document fallback
        try {
          const u = await User.findById(uid).select('stripeCustomerId stripe_customer_id').lean();
          if (u?.stripeCustomerId || u?.stripe_customer_id) {
            customerId = u.stripeCustomerId || u.stripe_customer_id;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!customerId && process.env.STRIPE_TEST_CUSTOMER) {
        customerId = process.env.STRIPE_TEST_CUSTOMER;
      }
      // --- REPLACE END ---

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
      if (err.code === 'NO_STRIPE_KEY') {
        return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
      }
      // --- REPLACE START: map transient network errors to clearer response ---
      if (err?.type === 'StripeConnectionError' || err?.code === 'ECONNRESET' || /socket hang up/i.test(String(err?.detail || err?.message))) {
        return res.status(502).json({ error: 'Temporary connection issue to Stripe. Please try again.' });
      }
      // --- REPLACE END ---
      return res.status(500).json({ error: 'Unable to open billing portal' });
    }
  }
);

/**
 * POST /api/billing/cancel-now
 * Cancels all ACTIVE/TRIALING subscriptions for the current user immediately.
 * This mirrors the runbook §8 behavior.
 *
 * Body (optional): { customerId?: string }  // for admin/testing
 */
router.post(
  '/cancel-now',
  authenticate,
  async (req, res) => {
    try {
      assertStripeKey();

      // Try to resolve Stripe customer:
      const explicitCustomer = req.body?.customerId;
      let customerId =
        explicitCustomer ||
        req.user?.stripeCustomerId ||
        req.user?.stripe_customer_id ||
        null;

      if (!customerId) {
        // Last-resort: find a Subscription doc linked to this user
        try {
          const sub = await Subscription.findOne({
            user: (req.userId || req.user?.id || req.user?._id),
            provider: 'stripe',
          })
            .sort({ createdAt: -1 })
            .lean();
          if (sub?.customerId || sub?.customer_id) {
            customerId = sub.customerId || sub.customer_id;
          }
        } catch (e) {
          // ignore
        }
      }

      // --- REPLACE START: user document fallback for customerId ---
      if (!customerId && (req.userId || req.user?.id || req.user?._id)) {
        try {
          const u = await User.findById(req.userId || req.user?.id || req.user?._id)
            .select('stripeCustomerId stripe_customer_id')
            .lean();
          if (u?.stripeCustomerId || u?.stripe_customer_id) {
            customerId = u.stripeCustomerId || u.stripe_customer_id;
          }
        } catch (e) {
          // ignore
        }
      }
      // --- REPLACE END ---

      if (!customerId) {
        return res.status(400).json({
          error:
            'No Stripe customer found for this user. Provide customerId in body or ensure user.stripeCustomerId exists.',
        });
      }

      // List all subs with status: active|trialing and cancel them now
      const allSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      });

      const targets = (allSubs?.data || []).filter(
        (s) => s?.status === 'active' || s?.status === 'trialing'
      );

      if (targets.length === 0) {
        return res.json({ ok: true, message: 'No active/trialing subscriptions to cancel.' });
      }

      const results = [];
      for (const sub of targets) {
        try {
          const canceled = await cancelStripeSubscriptionById(sub.id);
          results.push({ id: sub.id, status: 'canceled', at: new Date().toISOString(), data: canceled });
        } catch (e) {
          console.error('Cancel subscription failed:', sub.id, e?.message || e);
          results.push({ id: sub.id, status: 'error', error: e?.message || String(e) });
        }
      }

      return res.json({ ok: true, customerId, results });
    } catch (err) {
      console.error('cancel-now error:', err);
      if (err.code === 'NO_STRIPE_KEY') {
        return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
      }
      return res.status(500).json({ error: 'Unable to cancel subscription(s) now' });
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
router.post('/stripe-session', authenticate, async (req, res) => {
  try {
    assertStripeKey();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      metadata: { userId: req.userId || req.user?.id || '' },
      success_url: `${getClientUrl()}/settings/subscriptions?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getClientUrl()}/settings/subscriptions?canceled=1`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    if (err.code === 'NO_STRIPE_KEY') {
      return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

/**
 * POST /api/payment/paypal-order
 * Creates a PayPal order for subscriptions
 */
router.post('/paypal-order', authenticate, async (req, res) => {
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
  authenticate,
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

/* **********************************************************************
 * NEW: SYNC endpoint to reconcile DB state with Stripe
 * *********************************************************************/

// --- REPLACE START: add POST /sync to reconcile DB with Stripe ---
/**
 * POST /api/billing/sync
 * Reconciles user's premium flags with Stripe subscriptions.
 * Body (optional): { customerId?: string }
 *
 * Resolution order for customerId:
 *  - body.customerId
 *  - req.user.stripeCustomerId / stripe_customer_id
 *  - User(stripeCustomerId) by uid
 *  - Subscription(provider='stripe') by uid
 *  - STRIPE_TEST_CUSTOMER (env fallback for testing)
 */
router.post('/sync', authenticate, async (req, res) => {
  try {
    assertStripeKey();

    const uid = req.userId || req.user?.id || req.user?._id || null;

    // Resolve Stripe customer id
    let customerId =
      req.body?.customerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    // Try to read from User doc if missing
    if (!customerId && uid) {
      try {
        const u = await User.findById(uid).select('stripeCustomerId stripe_customer_id').lean();
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          customerId = u.stripeCustomerId || u.stripe_customer_id;
        }
      } catch (_) {}
    }

    // Try Subscription collection as last DB fallback
    if (!customerId && uid) {
      try {
        const sub = await Subscription.findOne({
          user: uid,
          provider: 'stripe',
        })
          .sort({ createdAt: -1 })
          .lean();
        if (sub?.customerId || sub?.customer_id) {
          customerId = sub.customerId || sub.customer_id;
        }
      } catch (_) {}
    }

    // Allow testing fallback
    if (!customerId && process.env.STRIPE_TEST_CUSTOMER) {
      customerId = process.env.STRIPE_TEST_CUSTOMER;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found to sync.' });
    }

    // Read all subs and decide "premium"
    const allSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    const active = (allSubs?.data || []).filter(
      (s) => s?.status === 'active' || s?.status === 'trialing'
    );
    const isPremium = active.length > 0;
    const subscriptionId = isPremium ? active[0]?.id : null;

    // Persist to User if we know who we are
    let before = null;
    if (uid) {
      before = await User.findById(uid)
        .select('isPremium subscriptionId stripeCustomerId')
        .lean();

      await User.findByIdAndUpdate(uid, {
        isPremium,
        subscriptionId,
        stripeCustomerId: customerId,
      });
    }

    return res.json({
      ok: true,
      customerId,
      isPremium,
      subscriptionId,
      counts: { all: allSubs?.data?.length || 0, active: active.length },
      before,
    });
  } catch (err) {
    console.error('sync error:', err);
    if (err?.code === 'NO_STRIPE_KEY') {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    return res.status(500).json({ error: 'Unable to sync subscription state' });
  }
});
// --- REPLACE END ---

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---
