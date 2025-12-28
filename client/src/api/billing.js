// PATH: client/src/api/billing.js
// File: client/src/api/billing.js

// --- REPLACE START: Billing API client (create checkout, open portal, cancel now, sync) ---
import api from "../services/api/axiosInstance"; // use the shared Axios instance (with baseURL + interceptors)

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
 * Safe sessionStorage helpers (avoid crashes in private mode or SSR-like envs).
 */
function safeSessionGet(key) {
  try {
    if (typeof window === "undefined") return null;
    if (!window.sessionStorage) return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    if (!window.sessionStorage) return;
    sessionStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function safeSessionRemove(key) {
  try {
    if (typeof window === "undefined") return;
    if (!window.sessionStorage) return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

/**
 * Billing sync dedupe (prevents 429 bursts)
 * - We store the last successful sync result + timestamp per "attempt key".
 * - We also store last 429 reset time per key so we can avoid re-hitting the limiter.
 */
const SYNC_CACHE_PREFIX = "loventia:billing_sync:";
const SYNC_DEFAULT_COOLDOWN_MS = 15_000; // short cooldown to prevent multi-trigger hammering

// --- REPLACE START: add in-memory single-flight promise map (dedupe concurrent syncBilling calls) ---
/**
 * In-memory "single-flight" map to dedupe concurrent calls in the same tab/runtime.
 * This prevents StrictMode/dev double-mount bursts and rapid multi-trigger calls from
 * producing parallel /billing/sync requests even when sessionStorage cache is cold.
 *
 * Keying strategy:
 * - Base key uses the computed attemptKey (customerId + sessionId + status)
 * - We add a suffix if `force` is true so forced calls do not accidentally reuse
 *   a non-forced in-flight Promise (and vice versa).
 */
const billingSyncSingleFlightMap = new Map();
// --- REPLACE END ---

// --- REPLACE START: add a global throttle + last-known-good cache (dedupe even if keys differ) ---
/**
 * Global throttle (same runtime/tab) to protect against:
 * - Rapid double-clicks where React `setBusy(true)` has not rendered yet
 * - Multiple UI triggers that call syncBilling with different keys (sessionId/status)
 *
 * This is intentionally conservative: if we recently synced successfully, we return the
 * last known good payload and avoid hammering /billing/sync.
 */
const BILLING_SYNC_GLOBAL_THROTTLE_MS = 2_500; // small guard window for rapid bursts
let billingSyncGlobalLastCallAt = 0;
let billingSyncGlobalLastOkAt = 0;
let billingSyncGlobalLastData = null;
let billingSyncGlobalLastReset = null;
// --- REPLACE END ---

function buildSyncAttemptKey(params) {
  const customerId = params?.customerId || "";
  const sessionId = params?.sessionId || "";
  const status = params?.status || "";
  // Include all optional params to avoid collisions between different success pages.
  return `${SYNC_CACHE_PREFIX}${customerId}:${sessionId}:${status}`;
}

function readSyncCache(key) {
  const raw = safeSessionGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSyncCache(key, obj) {
  try {
    safeSessionSet(key, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

/**
 * Convert a 429 payload into a human-readable wait string (if reset is provided).
 * Expected example:
 * {
 *   "error": "Too Many Requests",
 *   "code": "RATE_LIMITED",
 *   "message": "Too many requests, please slow down.",
 *   "limit": 3,
 *   "remaining": 0,
 *   "reset": 1766650520355,
 *   "scope": "billing"
 * }
 */
function formatRateLimitMessage(resetMs) {
  if (typeof resetMs !== "number") return "Too many requests. Please slow down and try again.";
  const msLeft = Math.max(0, resetMs - Date.now());
  const secLeft = Math.ceil(msLeft / 1000);
  if (!Number.isFinite(secLeft) || secLeft <= 0) {
    return "Too many requests. Please slow down and try again.";
  }
  return `Too many requests. Please wait ${secLeft}s and try again.`;
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
      typeof opts === "string" ? opts : opts && typeof opts === "object" ? opts.email : undefined;

    // axiosInstance baseURL already includes `/api`
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
 *
 * Backward compatible usage:
 *   - syncBilling()                  // no args
 *   - syncBilling(customerId)        // string
 *   - syncBilling({ customerId, sessionId, status, force, cooldownMs })
 *
 * Notes:
 * - The server-side limiter for billing is strict. Multiple UI triggers can easily cause 429.
 * - We dedupe in sessionStorage by attemptKey and return the cached result during cooldown.
 * - We also dedupe concurrently in-memory via a "single-flight" Promise map.
 * - If we recently got 429, we avoid retrying until the reset timestamp.
 */
// client/src/api/billing.js

export async function syncBilling(arg) {
  // --- REPLACE START: allow options-object + add cooldown + handle 429 reset gracefully + single-flight in memory ---
  const opts =
    typeof arg === "string"
      ? { customerId: arg }
      : arg && typeof arg === "object"
      ? arg
      : {};

  const customerId = opts.customerId || undefined;
  const sessionId = opts.sessionId || undefined;
  const status = opts.status || undefined;

  const force = Boolean(opts.force);
  const cooldownMs =
    typeof opts.cooldownMs === "number" && opts.cooldownMs >= 0
      ? opts.cooldownMs
      : SYNC_DEFAULT_COOLDOWN_MS;

  const attemptKey = buildSyncAttemptKey({ customerId, sessionId, status });

  // --- REPLACE START: global throttle and global rate-limit guard (dedupe even if attempt keys differ) ---
  if (!force) {
    // If we know we're rate-limited globally until a reset time, do not retry yet.
    if (
      typeof billingSyncGlobalLastReset === "number" &&
      billingSyncGlobalLastReset > Date.now()
    ) {
      const err = new Error(formatRateLimitMessage(billingSyncGlobalLastReset));
      err.code = "RATE_LIMITED";
      err.reset = billingSyncGlobalLastReset;
      throw err;
    }

    // If we have a recent successful sync globally, return it (avoid hammering from multi-triggers).
    if (
      billingSyncGlobalLastData &&
      typeof billingSyncGlobalLastOkAt === "number" &&
      billingSyncGlobalLastOkAt > 0
    ) {
      const okAge = Date.now() - billingSyncGlobalLastOkAt;
      if (okAge >= 0 && okAge < cooldownMs) {
        return billingSyncGlobalLastData;
      }
    }

    // Short burst guard window (rapid double-clicks before `busy` renders).
    if (
      billingSyncGlobalLastData &&
      typeof billingSyncGlobalLastCallAt === "number"
    ) {
      const callAge = Date.now() - billingSyncGlobalLastCallAt;
      if (callAge >= 0 && callAge < BILLING_SYNC_GLOBAL_THROTTLE_MS) {
        return billingSyncGlobalLastData;
      }
    }
  }
  // --- REPLACE END ---

  // In-memory single-flight key (separate forced vs non-forced)
  const singleFlightKey = `${attemptKey}:${force ? "force" : "normal"}`;

  // If a same-key sync is already running in this runtime, reuse it.
  if (billingSyncSingleFlightMap.has(singleFlightKey)) {
    return billingSyncSingleFlightMap.get(singleFlightKey);
  }

  // Create a single-flight task promise and store it immediately (prevents races)
  const taskPromise = (async () => {
    // Track last call moment globally (best-effort)
    billingSyncGlobalLastCallAt = Date.now();

    // 1) If we have a cached success within cooldown and not forced, return it.
    if (!force) {
      const cached = readSyncCache(attemptKey);
      if (cached && cached.ok === true && typeof cached.at === "number") {
        const age = Date.now() - cached.at;
        if (age >= 0 && age < cooldownMs && cached.data) {
          // Also refresh global cache from session cache (keeps global guard consistent)
          billingSyncGlobalLastData = cached.data;
          billingSyncGlobalLastOkAt = cached.at;
          billingSyncGlobalLastReset = null;
          return cached.data;
        }
      }

      // 2) If we recently got 429 and reset is in the future, do not retry yet.
      if (cached && cached.rateLimited === true && typeof cached.reset === "number") {
        if (cached.reset > Date.now()) {
          // Mirror to global guard too (prevents other keys from hammering)
          billingSyncGlobalLastReset = cached.reset;

          const msg = formatRateLimitMessage(cached.reset);
          const err = new Error(msg);
          err.code = "RATE_LIMITED";
          err.reset = cached.reset;
          throw err;
        } else {
          // reset passed -> clear rate limit cache marker to allow retry
          // Keep any previous success cache if present (do not wipe blindly).
          if (!cached.data) {
            safeSessionRemove(attemptKey);
          } else {
            writeSyncCache(attemptKey, { ok: true, at: cached.at, data: cached.data });
          }
        }
      }
    }

    // 3) Mark "in flight" in sessionStorage to prevent fast re-entrancy (best-effort).
    //    This complements single-flight (in-memory) by also helping across hot reloads.
    const preCache = readSyncCache(attemptKey);
    if (
      !force &&
      preCache &&
      preCache.inFlight === true &&
      typeof preCache.inFlightAt === "number"
    ) {
      const inflightAge = Date.now() - preCache.inFlightAt;
      if (inflightAge >= 0 && inflightAge < 5_000 && preCache.data) {
        // If we have previous data, return it rather than hammering.
        // Also refresh global cache so other keys can reuse it.
        billingSyncGlobalLastData = preCache.data;
        billingSyncGlobalLastOkAt =
          typeof preCache.at === "number" ? preCache.at : billingSyncGlobalLastOkAt;
        return preCache.data;
      }
    }

    writeSyncCache(attemptKey, {
      inFlight: true,
      inFlightAt: Date.now(),
      // preserve last known good payload if any
      data: preCache?.data || null,
      at: preCache?.at || null,
      ok: preCache?.ok || null,
      rateLimited: preCache?.rateLimited || null,
      reset: preCache?.reset || null,
    });

    try {
      const res = await api.post("/billing/sync", {
        customerId,
        sessionId,
        status,
      });

      // Cache success (also clears inFlight marker)
      writeSyncCache(attemptKey, {
        ok: true,
        at: Date.now(),
        data: res?.data,
      });

      // --- REPLACE START: update global last-known-good cache after success ---
      billingSyncGlobalLastData = res?.data || null;
      billingSyncGlobalLastOkAt = Date.now();
      billingSyncGlobalLastReset = null;
      // --- REPLACE END ---

      return res?.data;
    } catch (e) {
      const statusCode = e?.response?.status;

      // If rate-limited, cache reset and throw a friendly message
      if (statusCode === 429) {
        // --- REPLACE START: honor Retry-After header if body.reset is missing ---
        const bodyReset = e?.response?.data?.reset;

        const headers = e?.response?.headers || {};
        const retryAfterRaw =
          headers["retry-after"] ??
          headers["Retry-After"] ??
          headers["RETRY-AFTER"];

        let retryAfterSeconds = null;
        if (typeof retryAfterRaw === "string" && retryAfterRaw.trim()) {
          const n = Number.parseInt(retryAfterRaw.trim(), 10);
          if (Number.isFinite(n) && n >= 0) retryAfterSeconds = n;
        } else if (typeof retryAfterRaw === "number" && Number.isFinite(retryAfterRaw)) {
          retryAfterSeconds = retryAfterRaw;
        } else if (Array.isArray(retryAfterRaw) && retryAfterRaw.length) {
          const first = String(retryAfterRaw[0] ?? "").trim();
          const n = Number.parseInt(first, 10);
          if (Number.isFinite(n) && n >= 0) retryAfterSeconds = n;
        }

        const reset =
          typeof bodyReset === "number" && Number.isFinite(bodyReset)
            ? bodyReset
            : typeof retryAfterSeconds === "number"
            ? Date.now() + retryAfterSeconds * 1000
            : null;

        const msg = formatRateLimitMessage(reset);
        // --- REPLACE END ---

        // Keep last known good data if we had any, but mark rate-limited.
        const existing = readSyncCache(attemptKey) || {};
        writeSyncCache(attemptKey, {
          ok: Boolean(existing?.ok),
          at: typeof existing?.at === "number" ? existing.at : null,
          data: existing?.data || null,
          rateLimited: true,
          reset: typeof reset === "number" ? reset : null,
        });

        // --- REPLACE START: set global reset so other keys are also protected ---
        if (typeof reset === "number") {
          billingSyncGlobalLastReset = reset;
        }
        // Keep whatever last good data we have (do not wipe it on 429)
        if (existing?.data && !billingSyncGlobalLastData) {
          billingSyncGlobalLastData = existing.data;
          billingSyncGlobalLastOkAt = typeof existing?.at === "number" ? existing.at : 0;
        }

        const err = new Error(msg);
        err.code = "RATE_LIMITED";
        if (typeof reset === "number") err.reset = reset;
        throw err;
        // --- REPLACE END ---
      }

      // For other failures, clear the inFlight marker so a manual retry can proceed.
      try {
        const existing = readSyncCache(attemptKey) || {};
        if (existing && existing.inFlight) {
          writeSyncCache(attemptKey, {
            ok: existing?.ok ?? null,
            at: typeof existing?.at === "number" ? existing.at : null,
            data: existing?.data || null,
            rateLimited: existing?.rateLimited || null,
            reset: typeof existing?.reset === "number" ? existing.reset : null,
          });
        }
      } catch {
        // ignore cache cleanup errors
      }

      if (statusCode === 401) {
        throw new Error("Unauthorized. Please log in and try again.");
      }
      const serverMsg = e?.response?.data?.error || e?.response?.data?.message;
      if (serverMsg) throw new Error(serverMsg);
      throw e;
    }
  })();

  billingSyncSingleFlightMap.set(singleFlightKey, taskPromise);

  try {
    return await taskPromise;
  } finally {
    // Always remove the Promise after it settles so future attempts can run.
    billingSyncSingleFlightMap.delete(singleFlightKey);
  }
  // --- REPLACE END ---
}

export default {
  createCheckoutSession,
  openBillingPortal,
  cancelNow,
  syncBilling,
};
// --- REPLACE END ---
