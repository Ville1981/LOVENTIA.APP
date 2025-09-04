// File: server/routes/payment.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
import express from 'express';
import 'dotenv/config';

// Use the same auth middleware module name used elsewhere in the app
import authenticate from '../middleware/authenticate.js';
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Stripe setup — USE CENTRALIZED CLIENT
   We import the shared Stripe client from server/config/stripe.js so there is
   exactly one place that defines API version, retries, timeouts, etc.
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: use centralized Stripe client instead of inline `new Stripe(...)` ---
import stripe from '../config/stripe.js';
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   PayPal SDK setup (preserved)
   NOTE: This section remains as-is to avoid breaking existing PayPal flows.
────────────────────────────────────────────────────────────────────────────── */
import paypal from '@paypal/checkout-server-sdk';

/* ──────────────────────────────────────────────────────────────────────────────
   Models (preserved)
   - Subscription: legacy + PayPal storage
   - User: used to store stripeCustomerId and premium flags
────────────────────────────────────────────────────────────────────────────── */
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';

const router = express.Router();

/* ──────────────────────────────────────────────────────────────────────────────
   PayPal environment based on .env (preserved)
────────────────────────────────────────────────────────────────────────────── */
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

/* **********************************************************************
 * Helpers
 * *********************************************************************/

/**
 * getClientUrl()
 * Returns the base URL where the frontend lives; used for Stripe return URLs.
 */
function getClientUrl() {
  // Where to send users back after Stripe checkout/portal
  return process.env.CLIENT_URL || 'http://localhost:5174';
}

/**
 * getPremiumPriceId()
 * Returns Stripe Price ID for Premium subscription.
 * We keep backward compatibility to older env names.
 */
function getPremiumPriceId() {
  // Prefer new variable but keep legacy fallback to avoid breaking deployments
  const id = process.env.STRIPE_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!id) {
    // Throwing here is intentional; caller will translate to 501 nicely
    throw new Error('Missing STRIPE_PRICE_ID (or STRIPE_PREMIUM_PRICE_ID) in environment');
  }
  return id;
}

/**
 * assertStripeKey()
 * Safety guard so routes fail fast if Stripe is not configured.
 */
function assertStripeKey() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error('Missing STRIPE_SECRET_KEY in environment.');
    err.code = 'NO_STRIPE_KEY';
    throw err;
  }
}

/**
 * cancelStripeSubscriptionById(subId)
 * Cancels a subscription immediately. Compatible with older/newer SDKs.
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

/**
 * ensureStripeCustomerForUser(user)
 * Creates a Stripe Customer and persists stripeCustomerId on the User document
 * if one does not already exist. Accepts a user object with {_id|id, email, name, username, stripeCustomerId}.
 */
async function ensureStripeCustomerForUser(user) {
  if (!user) throw new Error('No user provided');
  const existing = user.stripeCustomerId || user.stripe_customer_id;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || user.username || undefined,
    metadata: { userId: String(user._id || user.id || '') },
  });

  await User.findByIdAndUpdate(
    user._id || user.id,
    { stripeCustomerId: customer.id },
    { new: true }
  ).exec();

  return customer.id;
}

/**
 * reconcilePremiumForCustomer(customerId, userId?)
 * Reads subscriptions from Stripe (authoritative) and updates the User record:
 *   - premium/isPremium = true if any subscription is active or trialing
 *   - subscriptionId = newest active/trialing subscription id (or unset if none)
 *   - keep stripeCustomerId on the user document
 *
 * Returns { isPremium, subscriptionId } for the caller to surface in responses.
 */
async function reconcilePremiumForCustomer(customerId, userId = null) {
  if (!customerId) {
    if (userId) {
      await User.findByIdAndUpdate(
        userId,
        { isPremium: false, premium: false, $unset: { subscriptionId: '' } },
        { new: true }
      ).exec();
    }
    return { isPremium: false, subscriptionId: null };
  }

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  const all = Array.isArray(subs?.data) ? subs.data : [];
  const active = all.filter((s) => s?.status === 'active' || s?.status === 'trialing');

  const newestActive = active.length
    ? active.slice().sort((a, b) => (a.created || 0) - (b.created || 0)).pop()
    : null;

  const effectiveIsPremium = active.length > 0;
  const effectiveSubId = newestActive ? newestActive.id : null;

  await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    {
      isPremium: effectiveIsPremium,
      premium: effectiveIsPremium, // legacy mirror
      ...(effectiveSubId
        ? { subscriptionId: effectiveSubId }
        : { $unset: { subscriptionId: '' } }),
    },
    { new: true }
  ).exec();

  if (userId) {
    // Make sure the mapping back to the user stores the customerId
    await User.findByIdAndUpdate(
      userId,
      { stripeCustomerId: customerId },
      { new: true }
    ).exec();
  }

  return { isPremium: effectiveIsPremium, subscriptionId: effectiveSubId };
}

/* **********************************************************************
 * NEW: Billing endpoints expected by the frontend
 *
 * IMPORTANT:
 *  - These handlers are mounted under `/api/billing` (and also `/api/payment`
 *    for backward compatibility) by the main app.
 *  - DO NOT prefix the paths here with `/billing`; the parent app.use() adds it.
 *
 * Implemented endpoints:
 *  - POST /create-checkout-session → forces locale: 'en'
 *  - POST /portal                  → forces locale: 'en' + creates customer if missing
 *  - POST /cancel-now              → cancels ACTIVE/TRIALING subs and then syncs
 *  - POST /sync                    → authoritative sync from Stripe → user.isPremium
 *
 * We also preserve legacy PayPal and Stripe endpoints to avoid breaking older clients.
 * *********************************************************************/

/**
 * POST /api/billing/create-checkout-session
 * Creates a Stripe Checkout Session for a subscription.
 * Body (optional): { email?: string, customerId?: string }
 * Ensures only one of {customer, customer_email} is set and sets locale:'en'.
 */
router.post('/create-checkout-session', authenticate, async (req, res) => {
  try {
    assertStripeKey();

    const { email, customerId: bodyCustomerId } = req.body || {};
    const uid = req.userId || req.user?._id || req.user?.id || null;
    const clientUrl = getClientUrl();

    // Resolve existing customer to avoid creating duplicates
    let resolvedCustomerId =
      bodyCustomerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!resolvedCustomerId && uid) {
      try {
        const u = await User.findById(uid)
          .select('stripeCustomerId stripe_customer_id email name username')
          .lean();
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          resolvedCustomerId = u.stripeCustomerId || u.stripe_customer_id;
        } else {
          // Create on-demand and persist
          resolvedCustomerId = await ensureStripeCustomerForUser({ ...u, _id: uid });
        }
      } catch (_) {
        // Fallback to creating from req.user if possible
        if (req.user) {
          resolvedCustomerId = await ensureStripeCustomerForUser(req.user);
        }
      }
    }

    // Build params; send either `customer` or `customer_email`, not both
    const params = {
      mode: 'subscription',
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      success_url: `${clientUrl}/settings/subscriptions?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/settings/subscriptions?canceled=1`,
      allow_promotion_codes: true,
      // Force English UI for Checkout
      locale: 'en',
      metadata: {
        userId: uid || '',
        username: req.user?.username || '',
      },
      client_reference_id: uid || undefined,
    };

    if (resolvedCustomerId) {
      params.customer = resolvedCustomerId;
    } else if (email) {
      params.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    if (err.code === 'NO_STRIPE_KEY' || /STRIPE_PRICE_ID|STRIPE_PREMIUM_PRICE_ID/i.test(String(err?.message))) {
      return res.status(501).json({
        error:
          'Billing not configured: ensure STRIPE_SECRET_KEY and STRIPE_PRICE_ID (or STRIPE_PREMIUM_PRICE_ID) are set.',
      });
    }
    return res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

/**
 * POST /api/billing/portal
 * Opens Stripe Billing Portal (and creates a customer if missing).
 * Adds `locale: 'en'` to the Portal session to keep it English.
 */
router.post('/portal', authenticate, async (req, res) => {
  try {
    assertStripeKey();

    const uid = req.userId || req.user?._id || req.user?.id || null;
    if (!uid && !req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Ensure we have a Stripe customer
    let customerId =
      req.body?.customerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!customerId) {
      if (uid) {
        const doc = await User.findById(uid)
          .select('stripeCustomerId email name username')
          .lean();
        if (doc?.stripeCustomerId) {
          customerId = doc.stripeCustomerId;
        } else {
          customerId = await ensureStripeCustomerForUser({ ...doc, _id: uid });
        }
      } else if (req.user) {
        customerId = await ensureStripeCustomerForUser(req.user);
      }
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: getClientUrl() + '/settings/subscriptions',
      // Keep Portal in English
      locale: 'en',
    });

    return res.json({ url: portal.url });
  } catch (err) {
    console.error('portal error:', err);
    if (err.code === 'NO_STRIPE_KEY') {
      return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    // Keep generic error to avoid leaking internals
    return res.status(500).json({ error: 'Unable to open billing portal' });
  }
});

/**
 * Legacy alias kept for backward compatibility:
 * POST /api/billing/create-portal-session → delegates to /portal
 */
router.post('/create-portal-session', authenticate, async (req, res) => {
  // Delegate to /portal to avoid duplicating logic
  req.url = '/portal';
  return router.handle(req, res);
});

/**
 * POST /api/billing/cancel-now
 * Cancels all ACTIVE/TRIALING subscriptions now, then re-syncs DB state.
 * Body (optional): { customerId?: string } – helpful for admin/testing
 */
router.post('/cancel-now', authenticate, async (req, res) => {
  try {
    assertStripeKey();

    const uid = req.userId || req.user?._id || req.user?.id || null;

    // Resolve Stripe customerId
    let customerId =
      req.body?.customerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!customerId && uid) {
      try {
        const u = await User.findById(uid)
          .select('stripeCustomerId stripe_customer_id')
          .lean();
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          customerId = u.stripeCustomerId || u.stripe_customer_id;
        }
      } catch (_) {}
    }

    if (!customerId) {
      return res.status(400).json({
        error:
          'No Stripe customer found for this user. Provide customerId in body or ensure user.stripeCustomerId exists.',
      });
    }

    // Cancel active and trialing subscriptions
    const all = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    const targets = (all?.data || []).filter(
      (s) => s?.status === 'active' || s?.status === 'trialing'
    );

    const results = [];
    for (const sub of targets) {
      try {
        const canceled = await cancelStripeSubscriptionById(sub.id);
        results.push({
          id: sub.id,
          status: 'canceled',
          at: new Date().toISOString(),
          data: canceled,
        });
      } catch (e) {
        console.error('Cancel subscription failed:', sub.id, e?.message || e);
        results.push({
          id: sub.id,
          status: 'error',
          error: e?.message || String(e),
        });
      }
    }

    // Reconcile authoritative state from Stripe after cancellations
    const reconcile = await reconcilePremiumForCustomer(customerId, uid || null);

    return res.json({ ok: true, customerId, results, reconcile });
  } catch (err) {
    console.error('cancel-now error:', err);
    if (err.code === 'NO_STRIPE_KEY') {
      return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    return res.status(500).json({ error: 'Unable to cancel subscription(s) now' });
  }
});

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
 *  - STRIPE_TEST_CUSTOMER (env fallback for testing only)
 *
 * We normalize ALL related fields atomically to avoid conflicts:
 *   - user.isPremium
 *   - user.premium (legacy mirror)
 *   - user.subscriptionId
 */
router.post('/sync', authenticate, async (req, res) => {
  try {
    assertStripeKey();

    const uid = req.userId || req.user?.id || req.user?._id || null;

    // Resolve customerId with several fallbacks
    let customerId =
      req.body?.customerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!customerId && uid) {
      try {
        const u = await User.findById(uid)
          .select('stripeCustomerId stripe_customer_id')
          .lean();
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          customerId = u.stripeCustomerId || u.stripe_customer_id;
        }
      } catch (_) {}
    }

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

    if (!customerId && process.env.STRIPE_TEST_CUSTOMER) {
      customerId = process.env.STRIPE_TEST_CUSTOMER;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer found to sync.' });
    }

    // Snapshot pre-state for diagnostics
    const before = uid
      ? await User.findById(uid)
          .select('isPremium premium subscriptionId stripeCustomerId')
          .lean()
      : null;

    const result = await reconcilePremiumForCustomer(customerId, uid || null);

    return res.json({
      ok: true,
      customerId,
      isPremium: result.isPremium,
      subscriptionId: result.subscriptionId,
      before,
    });
  } catch (err) {
    console.error('sync error:', err);
    if (err?.code === 'NO_STRIPE_KEY') {
      return res.status(501).json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    return res.status(500).json({ error: 'Unable to sync subscription state' });
  }
});

/* **********************************************************************
 * EXISTING LEGACY PAYMENT ROUTES (preserved, unchanged logic)
 * *********************************************************************/

/**
 * POST /api/payment/stripe-session
 * Creates a Stripe Checkout session for subscriptions (legacy path).
 * Kept for old clients; new clients should call /api/billing/create-checkout-session.
 */
router.post('/stripe-session', authenticate, async (req, res) => {
  try {
    assertStripeKey();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      // Keep locale English here as well for consistency
      locale: 'en',
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
 * POST /api/payment/paypal-order (preserved)
 * Creates a PayPal order for subscriptions.
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
 * POST /api/payment/paypal-capture (preserved)
 * Captures a PayPal order and records subscription.
 */
router.post('/paypal-capture', authenticate, express.json(), async (req, res) => {
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
});

/**
 * POST /api/payment/paypal-webhook (preserved)
 * NOTE: This route expects raw body; ensure global bodyParser does not consume it first.
 */
router.post('/paypal-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
});

// --- REPLACE START: export default router ---
export default router;
// --- REPLACE END ---

