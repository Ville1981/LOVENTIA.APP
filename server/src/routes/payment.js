// PATH: server/src/routes/payment.js

// --- REPLACE START: convert CommonJS to ES modules and export default router ---
// Order imports to satisfy eslint-plugin-import rules:
// 1) external packages
// 2) internal modules (config, controllers, middleware, etc.)
import 'dotenv/config';
import paypal from '@paypal/checkout-server-sdk';
import express from 'express';

import { billingUrls } from '../config/stripe.js';
import {
  sync as billingSync,
  handleWebhook as stripeWebhook,
} from '../controllers/billingController.js';
import authenticate from '../middleware/authenticate.js';
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   Stripe setup — USE CENTRALIZED CLIENT
   We import the shared Stripe client from server/src/config/stripe.js so there is
   exactly one place that defines API version, retries, timeouts, etc.
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: lazy-load Stripe client ---
let stripe = null;
async function getStripe() {
  if (stripe) return stripe;
  try {
    // FIXED PATH: routes/ → ../config/stripe.js
    const mod = await import('../config/stripe.js');
    stripe = mod.default || mod;
  } catch (_e) {
    stripe = null;
  }
  return stripe;
}
// --- REPLACE END ---

/* ──────────────────────────────────────────────────────────────────────────────
   PayPal SDK setup (preserved)
   NOTE: This section remains as-is to avoid breaking existing PayPal flows.
────────────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────────
   Models (preserved)
   - Subscription: legacy + PayPal storage
   - User: used to store stripeCustomerId and premium flags
────────────────────────────────────────────────────────────────────────────── */
// --- REPLACE START: lazy-load Subscription model (fixed relative path) ---
let Subscription = null;
async function getSubscriptionModel() {
  if (Subscription) return Subscription;
  try {
    // was ../models/Subscription.js → fix to ../../models/Subscription.js
    const mod = await import('../../models/Subscription.js');
    Subscription = mod.default || mod.Subscription || mod;
  } catch (_e) {
    Subscription = null;
  }
  return Subscription;
}
// --- REPLACE END ---
// --- REPLACE START: lazy-load User model ---
let User = null;
async function getUserModel() {
  if (User) return User;
  try {
    const mod = await import('../models/User.js');
    User = mod.default || mod.User || mod;
  } catch (_e) {
    User = null;
  }
  return User;
}
// --- REPLACE END ---

const router = express.Router();

/* ──────────────────────────────────────────────────────────────────────────────
   PayPal environment based on .env (preserved)
────────────────────────────────────────────────────────────────────────────── */
const payPalEnv =
  process.env.PAYPAL_MODE === 'live'
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_SECRET,
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_SECRET,
      );
const payPalClient = new paypal.core.PayPalHttpClient(payPalEnv);

/* **********************************************************************
 * Helpers
 * *********************************************************************/

/**
 * getClientUrl()
 * Returns the base URL where the frontend lives; used for non-Stripe flows.
 */
function getClientUrl() {
  // Where to send users back after PayPal flows (Stripe uses billingUrls)
  return process.env.CLIENT_URL || 'http://localhost:5174';
}

/**
 * getPremiumPriceId()
 * Returns Stripe Price ID for Premium subscription.
 * We keep backward compatibility to older env names.
 */
function getPremiumPriceId() {
  // Prefer new variable but keep legacy fallback to avoid breaking deployments
  const id =
    process.env.STRIPE_PRICE_ID || process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!id) {
    // Throwing here is intentional; caller will translate to 501 nicely
    throw new Error(
      'Missing STRIPE_PRICE_ID (or STRIPE_PREMIUM_PRICE_ID) in environment',
    );
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

// --- REPLACE START: Super Like weekly quota baseline for downgrade/upgrade ---
/**
 * Default weekly quota for Super Likes when the user is Premium.
 * This mirrors billingController so behaviour stays consistent across
 * /api/billing/sync and /api/billing/cancel-now.
 */
const SUPERLIKES_PER_WEEK_DEFAULT = Number(
  process.env.SUPERLIKES_PER_WEEK || 3,
);
// --- REPLACE END ---

/**
 * cancelStripeSubscriptionById(subId)
 * Cancels a subscription immediately. Compatible with older/newer SDKs.
 */
// --- REPLACE START: silence no-useless-catch by disabling on the try line in cancelStripeSubscriptionById ---
async function cancelStripeSubscriptionById(subId) {
  const _stripe = await getStripe();
  if (!_stripe)
    throw Object.assign(new Error('Stripe not available'), {
      code: 'NO_STRIPE',
    });
  // eslint-disable-next-line no-useless-catch
  try {
    if (typeof _stripe.subscriptions?.cancel === 'function') {
      return await _stripe.subscriptions.cancel(subId);
    }
    // fallback – older SDKs
    if (typeof _stripe.subscriptions?.del === 'function') {
      return await _stripe.subscriptions.del(subId);
    }
    throw new Error(
      'stripe.subscriptions.cancel is not a function and .del unavailable',
    );
  } catch (e) {
    // Re-throw to be handled by caller
    throw e;
  }
}
// --- REPLACE END ---

/**
 * ensureStripeCustomerForUser(user)
 * Creates a Stripe Customer and persists stripeCustomerId on the User document
 * if one does not already exist. Accepts a user object with {_id|id, email, name, username, stripeCustomerId}.
 */
async function ensureStripeCustomerForUser(user) {
  if (!user) throw new Error('No user provided');
  const existing = user.stripeCustomerId || user.stripe_customer_id;
  if (existing) return existing;

  const _stripe = await getStripe();
  if (!_stripe)
    throw Object.assign(new Error('Stripe not available'), {
      code: 'NO_STRIPE',
    });

  const customer = await _stripe.customers.create({
    email: user.email || undefined,
    name: user.name || user.username || undefined,
    metadata: { userId: String(user._id || user.id || '') },
  });

  const _User = await getUserModel();
  if (_User?.findByIdAndUpdate) {
    await _User.findByIdAndUpdate(
      user._id || user.id,
      { stripeCustomerId: customer.id },
      { new: true },
    ).exec();
  }

  return customer.id;
}

// --- REPLACE START: reconcilePremiumForCustomer keeps entitlements.features.superLikesPerWeek in sync ---
/**
 * reconcilePremiumForCustomer(customerId, userId?)
 * Reads subscriptions from Stripe (authoritative) and updates the User record:
 *   - premium/isPremium = true if any subscription is active or trialing
 *   - subscriptionId    = newest active/trialing subscription id (or unset if none)
 *   - keep stripeCustomerId on the user document
 *   - keep entitlements.features.superLikesPerWeek numeric and aligned with tier:
 *       PREMIUM → SUPERLIKES_PER_WEEK_DEFAULT (env or 3)
 *       FREE    → 1
 *
 * Returns { isPremium, subscriptionId } for the caller to surface in responses.
 *
 * NOTE:
 *   We do NOT touch entitlements.quotas.superLikes.* here.
 *   Quota window/usage is handled by the Super Like controller.
 */
async function reconcilePremiumForCustomer(customerId, userId = null) {
  if (!customerId) {
    if (userId) {
      const _User = await getUserModel();
      if (_User?.findByIdAndUpdate) {
        await _User.findByIdAndUpdate(
          userId,
          {
            isPremium: false,
            premium: false,
            $unset: { subscriptionId: '' },
            // Keep FREE baseline for features when no customer/subscriptions
            'entitlements.features.superLikesPerWeek': 1,
          },
          { new: true },
        ).exec();
      }
    }
    return { isPremium: false, subscriptionId: null };
  }

  const _stripe = await getStripe();
  if (!_stripe)
    throw Object.assign(new Error('Stripe not available'), {
      code: 'NO_STRIPE',
    });

  const subs = await _stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  const all = Array.isArray(subs?.data) ? subs.data : [];
  const active = all.filter(
    (s) => s?.status === 'active' || s?.status === 'trialing',
  );

  const newestActive = active.length
    ? active
        .slice()
        .sort((a, b) => (a.created || 0) - (b.created || 0))
        .pop()
    : null;

  const effectiveIsPremium = active.length > 0;
  const effectiveSubId = newestActive ? newestActive.id : null;

  const _User = await getUserModel();
  if (_User?.findOneAndUpdate) {
    await _User.findOneAndUpdate(
      { stripeCustomerId: customerId },
      {
        isPremium: effectiveIsPremium,
        premium: effectiveIsPremium, // legacy mirror
        ...(effectiveSubId
          ? { subscriptionId: effectiveSubId }
          : { $unset: { subscriptionId: '' } }),
        // Align weekly Super Like feature quota numerically with premium state
        'entitlements.features.superLikesPerWeek': effectiveIsPremium
          ? SUPERLIKES_PER_WEEK_DEFAULT
          : 1,
      },
      { new: true },
    ).exec();
  }

  if (userId) {
    // Make sure the mapping back to the user stores the customerId
    const _User2 = await getUserModel();
    if (_User2?.findByIdAndUpdate) {
      await _User2.findByIdAndUpdate(
        userId,
        { stripeCustomerId: customerId },
        { new: true },
      ).exec();
    }
  }

  return { isPremium: effectiveIsPremium, subscriptionId: effectiveSubId };
}
// --- REPLACE END ---

/* **********************************************************************
 * DEV DIAGNOSTICS (optional):
 * Keep a small in-memory ring buffer of the last webhook-driven updates.
 * The Stripe webhook controller will call rememberEventRow() when it flips
 * premium state, and this router exposes GET /api/billing/__diag to inspect.
 * *********************************************************************/
// --- REPLACE START: lightweight ring buffer and diag endpoint ---
const BILLING_EVENT_LIMIT = 30;
const _billingEvents = []; // [{ts,type,customerId,subscriptionId,isPremium,source}]

function rememberEventRow(row) {
  try {
    const item = {
      ts: new Date().toISOString(),
      type: row?.type || 'unknown',
      customerId: row?.customerId || null,
      subscriptionId: row?.subscriptionId ?? null,
      isPremium: typeof row?.isPremium === 'boolean' ? row.isPremium : null,
      source: row?.source || 'webhook',
      note: row?.note,
    };
    _billingEvents.push(item);
    if (_billingEvents.length > BILLING_EVENT_LIMIT) _billingEvents.shift();
  } catch {
    // best-effort
  }
}

function getRecentBillingEvents() {
  return _billingEvents.slice().reverse();
}

// Expose GET /api/billing/__diag only in non-production by default
router.get('/__diag', async (_req, res) => {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENABLE_BILLING_DIAG !== 'true'
  ) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.json({
    limit: BILLING_EVENT_LIMIT,
    count: _billingEvents.length,
    items: getRecentBillingEvents(),
  });
});
// --- REPLACE END ---

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

    // Resolve existing customer to avoid creating duplicates
    let resolvedCustomerId =
      bodyCustomerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!resolvedCustomerId && uid) {
      try {
        const _User = await getUserModel();
        let u = null;
        if (_User?.findById) {
          u = await _User.findById(uid)
            .select('stripeCustomerId stripe_customer_id email name username')
            .lean();
        }
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          resolvedCustomerId = u.stripeCustomerId || u.stripe_customer_id;
        } else {
          // Create on-demand and persist
          resolvedCustomerId = await ensureStripeCustomerForUser({
            ...u,
            _id: uid,
          });
        }
      } catch (_e) {
        // Fallback to creating from req.user if possible
        if (req.user) {
          resolvedCustomerId = await ensureStripeCustomerForUser(req.user);
        }
      }
    }

    // Build params; send either `customer` or `customer_email`, not both
    const params = {
      mode: 'subscription', // required subscription mode
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      // --- REPLACE START: use centralized billingUrls for success/cancel ---
      success_url: billingUrls.successUrl,
      cancel_url: billingUrls.cancelUrl,
      // --- REPLACE END ---
      allow_promotion_codes: true,
      // Force English UI for Checkout
      locale: 'en',
      // --- IMPORTANT: attach the user linkage for webhook resolver ---
      metadata: {
        userId: uid || '', // important metadata
        username: req.user?.username || '',
      },
      client_reference_id: uid || undefined,
    };

    if (resolvedCustomerId) {
      params.customer = resolvedCustomerId;
    } else if (email) {
      params.customer_email = email;
    }

    const _stripe = await getStripe();
    if (!_stripe) {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing Stripe client.' });
    }

    // This is the exact place that creates the Checkout Session
    const session = await _stripe.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    if (
      err.code === 'NO_STRIPE_KEY' ||
      /STRIPE_PRICE_ID|STRIPE_PREMIUM_PRICE_ID/i.test(String(err?.message))
    ) {
      return res.status(501).json({
        error:
          'Billing not configured: ensure STRIPE_SECRET_KEY and STRIPE_PRICE_ID (or STRIPE_PREMIUM_PRICE_ID) are set.',
      });
    }
    return res
      .status(500)
      .json({ error: 'Unable to create checkout session' });
  }
});

// --- REPLACE START: factor portal logic into a shared handler + robust alias ---
/**
 * Shared implementation for opening the Stripe Billing Portal.
 * Ensures a Stripe customer exists, then creates a portal session.
 * Uses centralized billingUrls.returnUrl (with safe fallback) and forces locale:'en'.
 */
async function _openStripePortal(req, res) {
  // eslint-disable-next-line no-useless-catch
  try {
    assertStripeKey();

    const uid = req.userId || req.user?._id || req.user?.id || null;
    if (!uid && !req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Resolve or lazily create a Stripe customer for this user
    let customerId =
      req.body?.customerId ||
      req.user?.stripeCustomerId ||
      req.user?.stripe_customer_id ||
      null;

    if (!customerId) {
      if (uid) {
        const _User = await getUserModel();
        let doc = null;
        if (_User?.findById) {
          doc = await _User.findById(uid)
            .select('stripeCustomerId email name username')
            .lean();
        }
        if (doc?.stripeCustomerId) {
          customerId = doc.stripeCustomerId;
        } else {
          customerId = await ensureStripeCustomerForUser({ ...doc, _id: uid });
        }
      } else if (req.user) {
        customerId = await ensureStripeCustomerForUser(req.user);
      }
    }

    const _stripe = await getStripe();
    if (!_stripe) {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing Stripe client.' });
    }

    // Prefer centralized URL if available; otherwise fall back to client URL
    const safeReturnUrl =
      (typeof billingUrls?.returnUrl === 'string' && billingUrls.returnUrl) ||
      `${getClientUrl()}/settings/subscriptions`;

    const portal = await _stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl,
      // Keep Portal UI in English for consistency
      locale: 'en',
    });

    return res.json({ url: portal.url });
  } catch (err) {
    // keep identical control flow but silence no-useless-catch
    throw err;
  }
}

/**
 * POST /api/billing/portal
 * Opens Stripe Billing Portal using the shared handler above.
 */
router.post('/portal', authenticate, _openStripePortal);

/**
 * Legacy alias for backward compatibility:
 * POST /api/billing/create-portal-session
 * Call the same handler directly; never recurse via router.handle().
 * Let errors bubble to the global error handler.
 */
router.post(
  '/create-portal-session',
  authenticate,
  (req, res, next) => _openStripePortal(req, res).catch(next),
);
// --- REPLACE END ---

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
        const _User = await getUserModel();
        let u = null;
        if (_User?.findById) {
          u = await _User.findById(uid)
            .select('stripeCustomerId stripe_customer_id')
            .lean();
        }
        if (u?.stripeCustomerId || u?.stripe_customer_id) {
          customerId = u.stripeCustomerId || u.stripe_customer_id;
        }
      } catch (_e) {
        /* no-op (best effort lookup) */
      }
    }

    if (!customerId) {
      return res.status(400).json({
        error:
          'No Stripe customer found for this user. Provide customerId in body or ensure user.stripeCustomerId exists.',
      });
    }

    // Cancel active and trialing subscriptions
    const _stripe = await getStripe();
    if (!_stripe) {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing Stripe client.' });
    }
    const all = await _stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });

    const targets = (all?.data || []).filter(
      (s) => s?.status === 'active' || s?.status === 'trialing',
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
        console.error(
          'Cancel subscription failed:',
          sub.id,
          e?.message || e,
        );
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
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    return res
      .status(500)
      .json({ error: 'Unable to cancel subscription(s) now' });
  }
});

/**
 * POST /api/billing/sync
 * Reconciles user's premium flags with Stripe subscriptions.
 * Body (optional): { customerId?: string }
 *
 * NOTE: We DELEGATE to the durable controller to keep a single source of truth.
 * The controller:
 *  - Reads Stripe authoritative state
 *  - Atomically writes user.isPremium / subscriptionId / entitlements.*
 *  - Returns { ok, isPremium, subscriptionId, user: normalizeUserOut(updated) }
 */
// --- REPLACE START: delegate /sync to controllers/billingController.sync ---
router.post('/sync', authenticate, (req, res, next) => {
  /* eslint-disable-next-line no-useless-catch */
  try {
    const p = billingSync(req, res);
    if (p && typeof p.then === 'function') p.catch(next);
  } catch (err) {
    // keep original flow; eslint suppressed above
    next(err);
  }
});
// --- REPLACE END ---

/**
 * POST /api/billing/webhook
 * Stripe requires raw body for signature verification.
 * We forward directly to the controller’s verified handler.
 */
// --- REPLACE START: add webhook with raw body for Stripe signature verification ---
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      const p = stripeWebhook(req, res);
      if (p && typeof p.then === 'function') p.catch(next);
    } catch (e) {
      next(e);
    }
  },
);
// --- REPLACE END ---

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
    const _stripe = await getStripe();
    if (!_stripe) {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing Stripe client.' });
    }
    const uid = req.userId || req.user?.id || null;

    // This is the exact call with the explicit snippet you requested
    const session = await _stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription', // or 'payment' — here it is 'subscription'
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      // Keep locale English here as well for consistency
      locale: 'en',
      metadata: { userId: uid || '' }, // important metadata
      client_reference_id: uid || undefined,
      // --- REPLACE START: use centralized billingUrls for success/cancel (legacy path) ---
      success_url: billingUrls.successUrl,
      cancel_url: billingUrls.cancelUrl,
      // --- REPLACE END ---
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    if (err.code === 'NO_STRIPE_KEY') {
      return res
        .status(501)
        .json({ error: 'Billing not configured: missing STRIPE_SECRET_KEY.' });
    }
    res
      .status(500)
      .json({ error: 'Unable to create checkout session' });
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
    res
      .status(500)
      .json({ error: 'Unable to create PayPal order' });
  }
});

/**
 * POST /api/payment/paypal-capture (preserved)
 * Captures a PayPal order and records subscription.
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

      const _Sub = await getSubscriptionModel();
      if (_Sub?.create) {
        await _Sub.create({
          user: req.userId || req.user?.id,
          plan: 'premium',
          provider: 'paypal',
          subscriptionId: capture.result.id,
        });
      }

      res.json({ status: capture.result.status, details: capture.result });
    } catch (err) {
      console.error('PayPal capture error:', err);
      res
        .status(500)
        .json({ error: 'Unable to capture PayPal order' });
    }
  },
);

/**
 * POST /api/payment/paypal-webhook (preserved)
 * NOTE: This route expects raw body; ensure global bodyParser does not consume it first.
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
    // --- REPLACE START: fix verify request body shape (no stray lines/comments) ---
    verifyReq.requestBody({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    });
    // --- REPLACE END ---

    try {
      const response = await payPalClient.execute(verifyReq);
      if (response.result.verification_status === 'SUCCESS') {
        const event = JSON.parse(body);
        console.log('Verified PayPal webhook event:', event.event_type);

        switch (event.event_type) {
          case 'PAYMENT.CAPTURE.COMPLETED': {
            const _Sub = await getSubscriptionModel();
            if (_Sub?.create) {
              await _Sub.create({
                user: event.resource?.supplementary_data?.related_ids?.order_id,
                plan: 'premium',
                provider: 'paypal',
                subscriptionId: event.resource?.id,
              });
            }
            break;
          }

          case 'PAYMENT.CAPTURE.DENIED':
            console.warn('PayPal payment denied:', event.resource);
            break;

          default:
            console.log(`Unhandled PayPal event: ${event.event_type}`);
        }
        res.sendStatus(200);
      } else {
        console.error(
          'PayPal webhook verification failed:',
          response.result,
        );
        res.sendStatus(400);
      }
    } catch (err) {
      console.error('Error handling PayPal webhook:', err);
      res.sendStatus(500);
    }
  },
);

// --- REPLACE START: export default router (and named diag helpers) ---
// Include reconcilePremiumForCustomer so the webhook controller can import it.
// This avoids duplicate definitions elsewhere and keeps a single source of truth.
export default router;
export { rememberEventRow, getRecentBillingEvents, reconcilePremiumForCustomer };
// --- REPLACE END ---


