// --- REPLACE START: unified Stripe webhook router (raw body, mocks, logging) ---
import express from 'express';
import 'dotenv/config';

// Keep a single router instance for this module
const router = express.Router();

/* ──────────────────────────────────────────────────────────────────────────────
   Lazy loaders (paths are relative to server/src/routes/*)
   - Stripe client comes from a centralized initializer.
   - User model is resolved lazily to avoid import cycles in tests.
────────────────────────────────────────────────────────────────────────────── */
let stripeClient = null;
async function getStripe() {
  if (stripeClient) return stripeClient;
  try {
    // Centralized Stripe config should export an initialized Stripe instance as default
    // Adjust the path if your config lives elsewhere (likely ../config/stripe.js from routes/)
    const mod = await import('../config/stripe.js');
    stripeClient = mod.default || mod; // support both default and module shape
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Failed to load Stripe client:', e?.message || e);
    stripeClient = null;
  }
  return stripeClient;
}

let UserModel = null;
async function getUserModel() {
  if (UserModel) return UserModel;
  try {
    const mod = await import('../models/User.js');
    UserModel = mod.default || mod.User || mod;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Failed to load User model:', e?.message || e);
    UserModel = null;
  }
  return UserModel;
}

/* ──────────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────────── */
/**
 * Update user premium flags by userId. Optionally set stripeCustomerId and subscriptionId.
 * Writes both `isPremium` and `premium` for backward compatibility.
 */
async function setUserPremiumById(userId, value, stripeCustomerId = null, subscriptionId = null) {
  if (!userId) return false;
  const User = await getUserModel();
  if (!User) return false;

  const update = { isPremium: !!value, premium: !!value };
  if (stripeCustomerId) update.stripeCustomerId = stripeCustomerId;
  if (subscriptionId) update.subscriptionId = subscriptionId;

  const res = await User.findByIdAndUpdate(userId, update, { new: true }).exec();
  // eslint-disable-next-line no-console
  console.log(
    `[webhook] setUserPremiumById: user=${userId} → ${!!value}` +
      (stripeCustomerId ? ` (customer=${stripeCustomerId})` : '') +
      (subscriptionId ? ` (sub=${subscriptionId})` : '')
  );
  return !!res;
}

/**
 * Update user premium flags by stripeCustomerId. Optionally set/unset subscriptionId.
 * Pass subscriptionId=null to $unset it; pass undefined to leave it unchanged.
 */
async function setUserPremiumByCustomerId(customerId, value, subscriptionId = undefined) {
  if (!customerId) return false;
  const User = await getUserModel();
  if (!User) return false;

  const update = { isPremium: !!value, premium: !!value };
  if (subscriptionId !== undefined) {
    if (subscriptionId === null) update.$unset = { subscriptionId: '' };
    else update.subscriptionId = subscriptionId;
  }

  const res = await User.findOneAndUpdate({ stripeCustomerId: customerId }, update, { new: true }).exec();
  // eslint-disable-next-line no-console
  console.log(
    `[webhook] setUserPremiumByCustomerId: customer=${customerId} → ${!!value}` +
      (subscriptionId === undefined ? '' : subscriptionId === null ? ' (unset subId)' : ` (sub=${subscriptionId})`)
  );
  return !!res;
}

/**
 * Set (or unset) subscriptionId by customerId without touching premium flags.
 */
async function setSubscriptionIdByCustomerId(customerId, subscriptionId) {
  if (!customerId) return false;
  const User = await getUserModel();
  if (!User) return false;

  if (subscriptionId === null) {
    await User.findOneAndUpdate({ stripeCustomerId: customerId }, { $unset: { subscriptionId: '' } }, { new: true }).exec();
    // eslint-disable-next-line no-console
    console.log(`[webhook] unset subscriptionId for customer=${customerId}`);
    return true;
  }

  const res = await User.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { subscriptionId },
    { new: true }
  ).exec();

  // eslint-disable-next-line no-console
  console.log(`[webhook] set subscriptionId=${subscriptionId} for customer=${customerId}`);
  return !!res;
}

/**
 * Ensure legacy flags (`isPremium` and `premium`) match for a given customer.
 */
async function ensurePremiumConsistencyByCustomerId(customerId) {
  const User = await getUserModel();
  if (!User || !customerId) return false;

  const doc = await User.findOne({ stripeCustomerId: customerId })
    .select('_id isPremium premium')
    .lean()
    .exec();

  if (!doc) return false;
  const a = !!doc.isPremium;
  const b = !!doc.premium;
  if (a === b) return true;

  const target = a || b;
  await User.findByIdAndUpdate(doc._id, { isPremium: target, premium: target }, { new: true }).exec();
  // eslint-disable-next-line no-console
  console.log(`[webhook] ensured consistency for user=${doc._id} → ${target}`);
  return true;
}

/**
 * Authoritative sync from Stripe:
 * - If any subscription is active/trialing → premium=true, else false
 * - Persists the newest active/trialing subscriptionId (by created), or unsets when none
 */
async function syncPremiumFromStripe(customerId) {
  if (!customerId) return;

  const stripe = await getStripe();
  if (!stripe) return;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });

  const all = Array.isArray(subs?.data) ? subs.data : [];
  const activeTrial = all.filter((s) => s?.status === 'active' || s?.status === 'trialing');

  const target = activeTrial.length > 0;
  let latestActiveSubId = null;
  if (activeTrial.length > 0) {
    latestActiveSubId = activeTrial.slice().sort((a, b) => (b.created || 0) - (a.created || 0))[0]?.id || null;
  }

  await setUserPremiumByCustomerId(customerId, target, latestActiveSubId ?? null);
  await ensurePremiumConsistencyByCustomerId(customerId);

  // eslint-disable-next-line no-console
  console.log(
    `[webhook] syncPremiumFromStripe: customer=${customerId} activeCount=${activeTrial.length} ` +
      `→ isPremium=${target}, subscriptionId=${latestActiveSubId || 'null'}`
  );
}

/**
 * Resolve app userId from a Checkout Session:
 * Priority: session.metadata.userId → fallback: lookup by session.customer ↔ User.stripeCustomerId
 */
async function resolveUserFromCheckoutSession(session) {
  const User = await getUserModel();
  const metaUserId = session?.metadata?.userId || null;
  if (metaUserId) {
    return { userId: metaUserId, customerId: session?.customer || null };
  }
  const customerId = session?.customer || null;
  if (!customerId || !User) return { userId: null, customerId };

  const u = await User.findOne({ stripeCustomerId: customerId }).select('_id').lean().exec();
  return { userId: u?._id?.toString() || null, customerId };
}

/* ──────────────────────────────────────────────────────────────────────────────
   Core handler
   NOTE: This handler expects req.body to be a Buffer (express.raw middleware).
────────────────────────────────────────────────────────────────────────────── */
async function stripeWebhookHandler(req, res) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Missing STRIPE_WEBHOOK_SECRET — cannot verify webhooks.');
    return res.status(500).send('Stripe webhook is not configured on the server.');
  }

  const stripe = await getStripe();
  if (!stripe) {
    return res.status(500).send('Stripe client is not initialized.');
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    // req.body is a Buffer here (because of express.raw)
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  try {
    // eslint-disable-next-line no-console
    console.log(`[webhook] received event: ${event.type}`);

    // Optional: light-weight billing event logging (safe subset only)
    if (process.env.STRIPE_LOG_EVENTS === '1') {
      try {
        const { connection } = await import('mongoose');
        const BillingEvents = connection.collection('billing_events');
        await BillingEvents.insertOne({
          type: event?.type ?? 'unknown',
          id: event?.id ?? null,
          created: new Date(),
          raw: event?.data?.object
            ? {
                id: event.data.object.id,
                customer: event.data.object.customer ?? null,
                subscription: event.data.object.subscription ?? null,
                status: event.data.object.status ?? null,
                email: event.data.object.customer_email ?? null,
              }
            : null,
        });
      } catch (logErr) {
        // eslint-disable-next-line no-console
        console.warn('[stripe-webhook][log] failed to log billing event', logErr?.message || logErr);
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session?.customer || null;
        const subscriptionId = session?.subscription || null;

        const { userId } = await resolveUserFromCheckoutSession(session);

        if (userId) {
          await setUserPremiumById(userId, true, customerId, subscriptionId || undefined);
        } else if (customerId) {
          await setUserPremiumByCustomerId(customerId, true);
        }

        if (customerId) {
          if (subscriptionId) await setSubscriptionIdByCustomerId(customerId, subscriptionId);
          await syncPremiumFromStripe(customerId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub?.customer || null;
        const subId = sub?.id || null;

        if (customerId && subId) await setSubscriptionIdByCustomerId(customerId, subId);
        if (customerId) await syncPremiumFromStripe(customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub?.customer || null;

        if (customerId) {
          await setSubscriptionIdByCustomerId(customerId, null);
          await syncPremiumFromStripe(customerId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice?.customer || null;
        if (customerId) await syncPremiumFromStripe(customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        // eslint-disable-next-line no-console
        console.warn('[webhook] invoice.payment_failed:', invoice?.id);
        break;
      }

      default:
        // eslint-disable-next-line no-console
        console.log(`[webhook] Unhandled event: ${event.type}`);
    }

    return res.sendStatus(200);
  } catch (err) {
    // Never fail the whole delivery; log and 200 to avoid Stripe retries explosion
    // eslint-disable-next-line no-console
    console.error(`[webhook] Error processing ${event?.type || 'event'}:`, err);
    return res.sendStatus(200);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Routes
   We expose both '/' and '/payment/stripe-webhook' to be resilient against
   different app mounting styles.
   In app.js mount either:
     app.use('/api/payment/stripe-webhook', router)   // then path here should be '/'
   OR
     app.use('/api', router)                          // then path here should be '/payment/stripe-webhook'
────────────────────────────────────────────────────────────────────────────── */
const rawJson = express.raw({ type: 'application/json' });

// Preferred: when mounted at /api/payment/stripe-webhook
router.post('/', rawJson, stripeWebhookHandler);

// Back-compat: when mounted at /api
router.post('/payment/stripe-webhook', rawJson, stripeWebhookHandler);

/* ──────────────────────────────────────────────────────────────────────────────
   Optional mock endpoints (for tests and local E2E)
   Activated only when STRIPE_MOCK_MODE === '1'
────────────────────────────────────────────────────────────────────────────── */
if (process.env.STRIPE_MOCK_MODE === '1') {
  // Auth middleware is only required for mocks; keep import local to avoid cycles
  const { default: authenticate } = await import('../middleware/authenticate.js');

  // Premium ON (simulate checkout.session.completed)
  router.post('/mock/checkout-complete', authenticate, async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: 'User model not available' });

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.isPremium = true;
      user.premium = {
        ...(user.premium || {}),
        active: true,
        tier: 'premium',
        since: new Date(),
      };
      await user.save();

      return res.json({ ok: true, isPremium: user.isPremium, premium: user.premium });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mock/checkout-complete]', err);
      return res.status(500).json({ error: 'Server Error' });
    }
  });

  // Premium OFF (simulate customer.subscription.deleted)
  router.post('/mock/subscription-canceled', authenticate, async (req, res) => {
    try {
      const User = await getUserModel();
      if (!User) return res.status(500).json({ error: 'User model not available' });

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.isPremium = false;
      user.premium = {
        ...(user.premium || {}),
        active: false,
        canceledAt: new Date(),
      };
      await user.save();

      return res.json({ ok: true, isPremium: user.isPremium, premium: user.premium });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mock/subscription-canceled]', err);
      return res.status(500).json({ error: 'Server Error' });
    }
  });
}

export default router;
// --- REPLACE END ---





