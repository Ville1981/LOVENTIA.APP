// File: client/src/api/billing.js

// --- REPLACE START: Billing API client (create checkout, open portal, cancel now) ---
import api from "../utils/axiosInstance";

/**
 * Extract a URL from various server payload shapes.
 */
function extractUrl(payload) {
  if (!payload) return null;
  if (typeof payload.url === "string") return payload.url;
  if (payload.data && typeof payload.data.url === "string") return payload.data.url;
  return null;
}

/**
 * POST /billing/create-checkout-session
 * @param {Object} [opts]
 * @param {string} [opts.email] - Optional email to prefill Stripe Checkout
 * @returns {Promise<{ url: string, raw: any }>}
 */
export async function createCheckoutSession(opts = {}) {
  try {
    // NOTE: axiosInstance baseURL already includes /api
    const res = await api.post("/billing/create-checkout-session", {
      email: opts.email || undefined,
    });
    const url = extractUrl(res?.data);
    if (!url) {
      const msg =
        "Checkout session URL not returned by the server. Please try again later.";
      const err = new Error(msg);
      err.response = res;
      throw err;
    }
    return { url, raw: res?.data };
  } catch (e) {
    // Normalize common backend statuses → human-friendly message
    const status = e?.response?.status;
    if (status === 401) {
      throw new Error("Unauthorized. Please log in and try again.");
    }
    if (status === 404 || status === 501) {
      throw new Error(
        "Billing backend is not configured yet (or the route is unavailable)."
      );
    }
    throw e;
  }
}

/**
 * POST /billing/create-portal-session
 * @returns {Promise<{ url: string, raw: any }>}
 */
export async function openBillingPortal() {
  try {
    const res = await api.post("/billing/create-portal-session", {});
    const url = extractUrl(res?.data);
    if (!url) {
      const msg =
        "Billing portal URL not returned by the server. Please try again later.";
      const err = new Error(msg);
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
      throw new Error(
        "Billing backend is not configured yet (or the route is unavailable)."
      );
    }
    throw e;
  }
}

/**
 * POST /billing/cancel-now
 * Cancels all active/trialing subscriptions for the current user.
 * @returns {Promise<{ ok: boolean, results?: any[], customerId?: string, raw: any }>}
 */
export async function cancelNow() {
  try {
    const res = await api.post("/billing/cancel-now", {});
    // Server may return either { ok, results: [...] } or { ok, canceled: [...] }
    const results = res?.data?.results ?? res?.data?.canceled ?? [];
    return {
      ok: !!res?.data?.ok || Array.isArray(results),
      results,
      customerId: res?.data?.customerId,
      raw: res?.data,
    };
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
};
// --- REPLACE END ---
