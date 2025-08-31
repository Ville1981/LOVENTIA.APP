// File: server/models/Subscription.js

// --- REPLACE START: define robust Subscription schema (Stripe & PayPal) and export default model ---
import mongoose from 'mongoose';

/**
 * Subscription model
 * - Used by Stripe & PayPal flows
 * - Provides optional fields that our routes may look up (e.g., customerId for Stripe)
 * - Keeps timestamps for debugging and reporting
 * - Adds helpful indexes for common queries
 */
const subscriptionSchema = new mongoose.Schema(
  {
    // App user owning this subscription
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Plan at time of creation (kept simple)
    plan: {
      type: String,
      enum: ['premium', 'basic'],
      required: true,
      default: 'premium',
    },

    // Payment provider
    provider: {
      type: String,
      enum: ['stripe', 'paypal'],
      required: true,
      index: true,
    },

    /**
     * Provider-side subscription/order id
     * - Stripe: subscription.id (e.g., sub_123)
     * - PayPal: capture.id or subscription id depending on flow
     */
    subscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /**
     * Stripe-specific optional fields:
     * - customerId: used by /billing/create-portal-session fallback
     * - priceId: Price used in subscription (for reporting)
     * - status: Stripe subscription status snapshot (active, trialing, canceled, etc.)
     * - currentPeriodEnd/cancelAtPeriodEnd/canceledAt: timestamps to help UI messages
     */
    customerId: { type: String, default: null, index: true }, // Stripe customer id
    priceId: { type: String, default: null },
    status: { type: String, default: null }, // e.g. 'active', 'trialing', 'canceled', 'incomplete'
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },

    /**
     * Common optional financial snapshot (best-effort; not authoritative):
     */
    currency: { type: String, default: null }, // e.g., 'usd'
    amount: { type: Number, default: null }, // in smallest unit (e.g., cents)

    // Free-form provider metadata for audits/diagnostics
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Helpful compound indexes
try {
  subscriptionSchema.index(
    { user: 1, provider: 1, createdAt: -1 },
    { name: 'idx_sub_user_provider_created' }
  );
  subscriptionSchema.index(
    { provider: 1, customerId: 1 },
    { name: 'idx_sub_provider_customer' }
  );
} catch {
  /* noop */
}

const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
// --- REPLACE END ---
