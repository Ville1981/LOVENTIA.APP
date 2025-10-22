// PATH: server/src/controllers/stripeWebhookController.js

// --- REPLACE START: Robust Stripe webhook controller (checkout + invoice + subscription) ---
import 'dotenv/config';

/* ──────────────────────────────────────────────────────────────────────────────
   Centralized Stripe client (lazy import from ../config/stripe.js)
   This ensures one place defines API version, retries, timeouts, etc.
────────────────────────────────────────────────────────────────────────────── */
let stripe = null;
async function getStripe() {
  if (stripe) return stripe;
  try {
    const mod = await import('../config/stripe.js');
    stripe = mod?.default || mod;
  } catch {
    stripe = null;
  }
  return stripe;
}

/**
 * Always pass the exact signed payload (Buffer|string) to constructEvent().
 * Priority:
 *   1) req.rawBody (set by express verify() hook / route-level express.raw)
 *   2) req.body if it's Buffer|string
 *   3) JSON.stringify(req.body) as a deterministic last resort
 */
function getSignedPayload(req) {
  if (req?.rawBody && (Buffer.isBuffer(req.rawBody) || typeof req.rawBody === 'string')) {
    return req.rawBody;
  }
  if (Buffer.isBuffer(req?.body) || typeof req?.body === 'string') {
    return req.body;
  }
  try {
    return Buffer.from(JSON.stringify(req?.body ?? {}));
  } catch {
    return Buffer.from('{}');
  }
}

function log(...args)   { console.log('[stripeWebhook]', ...args); }
function warn(...args)  { console.warn('[stripeWebhook]', ...args); }
function error(...args) { console.error('[stripeWebhook]', ...args); }

/**
 * Main webhook handler.
 * NOTE: The route is mounted with `express.raw({ type: 'application/json' })`
 * in app.js, but we also support req.rawBody captured by expressLoader().
 */
export async function stripeWebhookHandler(req, res) {
  try {
    const _stripe = await getStripe();
    if (!_stripe?.webhooks?.constructEvent) {
      error('Stripe client unavailable (check STRIPE_SECRET_KEY/config).');
      return res.status(500).send('Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      error('STRIPE_WEBHOOK_SECRET missing — cannot verify webhook signatures.');
      return res.status(500).send('Webhook secret missing');
    }
    if (!sig) {
      warn('Missing stripe-signature header');
      return res.status(400).send('No signature header');
    }

    const payload = getSignedPayload(req);
    if (process.env.STRIPE_DEBUG) {
      const kind = Buffer.isBuffer(payload) ? `Buffer(${payload.length})` : typeof payload;
      log('payload kind:', kind);
    }

    let event;
    try {
      event = _stripe.webhooks.constructEvent(payload, sig, secret);
    } catch (err) {
      error('Signature verification failed:', err?.message || err);
      return res.status(400).send(`Webhook Error: ${err?.message || String(err)}`);
    }

    const type = event?.type || 'unknown';
    const obj = event?.data?.object ?? {};
    log('Event:', type, 'id=', event?.id);

    // Resolve customer + subscription hints from different event objects
    const customerId =
      obj.customer || obj.customer_id || (obj.object === 'checkout.session' ? obj.customer : null);

    let subId = null;
    if (obj.object === 'subscription') subId = obj.id || null;
    if (obj.object === 'invoice') subId = obj.subscription || null;
    if (obj.object === 'checkout.session') subId = obj.subscription || null;

    // Import helpers from payment router for authoritative reconciliation + diag ring buffer
    let reconcilePremiumForCustomer = null;
    let rememberEventRow = null;
    try {
      const mod = await import('../routes/payment.js');
      reconcilePremiumForCustomer = mod.reconcilePremiumForCustomer || null;
      rememberEventRow = mod.rememberEventRow || null;
    } catch {
      // Keep going; we will still ACK to avoid Stripe retries.
    }

    // Only these types adjust the premium state
    const HANDLE_TYPES = new Set([
      'checkout.session.completed',
      'invoice.paid',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ]);

    if (HANDLE_TYPES.has(type)) {
      if (customerId && typeof reconcilePremiumForCustomer === 'function') {
        try {
          // Prefer metadata.userId if present (checkout.session carries it)
          const userId =
            obj?.metadata?.userId ||
            (obj?.object === 'checkout.session' ? obj?.client_reference_id : null) ||
            null;

          const result = await reconcilePremiumForCustomer(customerId, userId);
          rememberEventRow?.({
            type,
            customerId,
            subscriptionId: result?.subscriptionId ?? subId ?? null,
            isPremium: !!result?.isPremium,
            source: 'webhook',
            note: event?.id,
          });
        } catch (e) {
          error('reconcile failed:', e?.message || e);
          rememberEventRow?.({
            type,
            customerId,
            subscriptionId: subId,
            isPremium: null,
            source: 'webhook(reconcile-error)',
            note: (event?.id || '') + ' ' + (e?.message || e),
          });
        }
      } else {
        rememberEventRow?.({
          type,
          customerId: customerId || null,
          subscriptionId: subId,
          isPremium: null,
          source: 'webhook(no-reconcile)',
          note: event?.id,
        });
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // Be quiet in production; log in dev
      log('Unhandled event type (no-op):', type);
    }

    // Always ACK so Stripe does not retry
    return res.status(200).send('ok');
  } catch (e) {
    error('unhandled error:', e?.message || e);
    return res.status(500).send('internal');
  }
}

export default { stripeWebhookHandler };
// --- REPLACE END ---





