# File: docs/stripe-live-cutover.md

# --- REPLACE START: Stripe live cutover checklist ---
# Stripe Live Cutover – Checklist

## 1) Keys & env
- [ ] Set **STRIPE_SECRET_KEY** (live)
- [ ] Set **STRIPE_WEBHOOK_SECRET** (live)
- [ ] Set **STRIPE_PRICE_ID** (live)
- [ ] Set **CHECKOUT_SUCCESS_URL** and **CHECKOUT_CANCEL_URL** to production domain
- [ ] Set **BILLING_RETURN_URL** to production domain
- [ ] Ensure **STRIPE_MOCK_MODE=0** in production

## 2) Webhook
- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://api.yourdomain.com/api/payment/stripe-webhook`
  - Events: checkout.session.completed, customer.subscription.*,
            invoice.payment_succeeded, invoice.payment_failed
  - Copy the **Signing secret** → set **STRIPE_WEBHOOK_SECRET**
- [ ] Verify server logs show 200 on test delivery
- [ ] Ensure `express.raw({ type: 'application/json' })` is used just for webhook route

## 3) Customer mapping
- [ ] On login/register, ensure **stripeCustomerId** is created/retrieved and stored
- [ ] Backfill missing customer IDs if needed (script or on-demand creation)

## 4) Flows
- [ ] Checkout session returns redirect, end-to-end tested
- [ ] Portal session works for existing subscribers
- [ ] Cancel-now endpoint toggles premium off, webhook syncs flags
- [ ] Subscriptions page reflects changes after return

## 5) Monitoring & rollback
- [ ] CloudWatch alarms for 5xx, latency, error spike
- [ ] Sentry release + server logs
- [ ] Rollback plan: revert task definition (ECS), invalidate CloudFront

## 6) Final smoke
- [ ] Live card (4242 test card **does not** work on live)
- [ ] Real payment for $1 test product (or minimal plan) – refund after
- [ ] Webhook receives events, user toggles to Premium, portal cancel toggles off
# --- REPLACE END ---
