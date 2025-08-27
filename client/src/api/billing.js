// File: client/src/api/billing.js

// --- REPLACE START: Billing API client (create checkout, open portal, cancel now, sync) ---
import api from "../utils/axiosInstance";

/**
 * Normalize `{ url }` from various payload shapes.
 */
function extractUrl(payload) {
  if (!payload) return null;
  if (typeof payload.url === "string") return payload.url;
  if (payload.data && typeof payload.data.url === "string") return payload.data.url;
  return null;
}

/**
 * POST /billing/create-checkout-session
 * Returns an object: { url, raw }
 *
 * Accepts either:
 *  - createCheckoutSession({ email })
 *  - createCheckoutSession("user@example.com")
 *  - createCheckoutSession()    // no email hint
 */
export async function createCheckoutSession(opts = {}) {
  try {
    const email =
      typeof opts === "string" ? opts : (opts && typeof opts === "object" ? opts.email : undefined);

    // NOTE: axiosInstance baseURL should already include `/api`
    const res = await api.post("/billing/create-checkout-session", {
      email: email || undefined,
    });

    const url = extractUrl(res?.data);
    if (!url) {
      const err = new Error("Checkout session URL not returned by the server.");
      err.response = res;
      throw err;
    }
    return { url, raw: res?.data };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      throw new Error("Unauthorized. Please log in and try again.");
    }
    if (status === 404 || status === 501) {
      throw new Error("Billing backend is not configured yet (or the route is unavailable).");
    }
    throw e;
  }
}

/**
 * POST /billing/create-portal-session
 * Returns an object: { url, raw }
 *
 * Optionally accepts a known Stripe customerId to force the target.
 */
export async function openBillingPortal(customerId) {
  try {
    const res = await api.post("/billing/create-portal-session", {
      customerId: customerId || undefined,
    });

    const url = extractUrl(res?.data);
    if (!url) {
      const err = new Error("Billing portal URL not returned by the server.");
      err.response = res;
      throw err;
    }
    return { url, raw: res?.data };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      throw new Error("Unauthorized. Please log in and try again.");
    }
    if (status === 404 || status === 501) {
      throw new Error("Billing backend is not configured yet (or the route is unavailable).");
    }
    throw e;
  }
}

/**
 * POST /billing/cancel-now
 * Cancels all ACTIVE/TRIALING subscriptions immediately.
 * Returns the raw server payload (so callers can inspect `.ok`, `.results`, etc.).
 */
export async function cancelNow(customerId) {
  try {
    const res = await api.post("/billing/cancel-now", {
      customerId: customerId || undefined,
    });
    return res?.data;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      throw new Error("Unauthorized. Please log in and try again.");
    }
    const serverMsg = e?.response?.data?.error;
    if (serverMsg) throw new Error(serverMsg);
    throw e;
  }
}

/**
 * POST /billing/sync
 * Reconciles user's premium flags with Stripe (source of truth).
 * Returns the raw server payload: { ok, customerId, isPremium, subscriptionId, counts, before }
 */
export async function syncBilling(customerId) {
  try {
    const res = await api.post("/billing/sync", {
      customerId: customerId || undefined,
    });
    return res?.data;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      throw new Error("Unauthorized. Please log in and try again.");
    }
    const serverMsg = e?.response?.data?.error;
    if (serverMsg) throw new Error(serverMsg);
    throw e;
  }
}

export default {
  createCheckoutSession,
  openBillingPortal,
  cancelNow,
  syncBilling,
};
// --- REPLACE END ---
