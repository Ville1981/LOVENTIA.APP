// PATH: client/src/utils/analytics.js

// --- REPLACE START: tiny analytics facade (consent-aware, pluggable provider) ---

/**
 * Simple, consent-aware analytics facade.
 *
 * Goals:
 * - All tracking goes through a single `track()` function.
 * - Respect cookie/consent banner: analytics can be globally enabled/disabled.
 * - Allow plugging in a real provider later (e.g. GA/Amplitude/own API)
 *   without changing the rest of the app.
 *
 * Public API:
 *  - setAnalyticsEnabled(enabled: boolean)
 *  - setAnalyticsProvider(fn: (event: string, payload: object) => void)
 *  - track(event: string, payload?: object, options?: { force?: boolean })
 *  - trackPageView(path: string, meta?: object)
 *  - trackAdImpression(type: string, meta?: object)
 *  - trackAdClick(type: string, meta?: object)
 */

/**
 * Whether non-essential analytics are allowed.
 * This is controlled by the consent system (ConsentProvider).
 */
let analyticsEnabled = false;

/**
 * Optional provider function that will receive events when:
 *  - analyticsEnabled === true
 *  - OR options.force === true
 *
 * Signature: (event: string, payload: object) => void
 */
let analyticsProvider = null;

/**
 * Enable or disable analytics based on user consent.
 * This should be called from the consent layer (e.g. ConsentProvider).
 *
 * @param {boolean} enabled
 */
export function setAnalyticsEnabled(enabled) {
  analyticsEnabled = !!enabled;
}

/**
 * Inject a real analytics provider.
 * Example (later):
 *   setAnalyticsProvider((event, payload) => {
 *     window.gtag("event", event, payload);
 *   });
 *
 * Passing a non-function will clear the provider.
 *
 * @param {(event: string, payload: object) => void | null} fn
 */
export function setAnalyticsProvider(fn) {
  if (typeof fn === "function") {
    analyticsProvider = fn;
  } else {
    analyticsProvider = null;
  }
}

/**
 * Core tracking function.
 *
 * @param {string} event   - event name, e.g. "page_view", "ad_click"
 * @param {object} payload - serializable metadata (optional)
 * @param {object} options - { force?: boolean }:
 *                           if force === true, provider is called
 *                           even when analyticsEnabled === false
 */
export function track(event, payload = {}, options = {}) {
  if (typeof event !== "string" || !event.trim()) {
    // Invalid event name – nothing to do
    return;
  }

  // Normalise payload to a plain object to avoid surprises.
  let safePayload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    safePayload = payload;
  } else if (payload == null) {
    safePayload = {};
  } else {
    // Wrap primitive / array payloads into an object for consistency.
    safePayload = { value: payload };
  }

  // Lightweight console debug for development.
  // This does NOT send anything to an external provider and is fine
  // even when analyticsEnabled === false.
  try {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${event}`, safePayload);
  } catch {
    /* noop */
  }

  // If there is no provider, we are done.
  if (!analyticsProvider) return;

  const force = !!options.force;

  // Respect consent: do not call the provider when analytics are disabled,
  // unless the caller explicitly forces it. This keeps "necessary" events
  // possible if we ever need them.
  if (!analyticsEnabled && !force) return;

  try {
    analyticsProvider(event, safePayload);
  } catch (err) {
    // Provider errors must never break the app.
    try {
      // eslint-disable-next-line no-console
      console.error("[analytics] provider error", err);
    } catch {
      /* noop */
    }
  }
}

/**
 * Track a page view.
 *
 * Called from RouteAnalytics in App.jsx when the route changes.
 *
 * @param {string} path - path + search (e.g. "/discover?age=30-40")
 * @param {object} meta - extra metadata (optional)
 */
export function trackPageView(path, meta = {}) {
  const normalisedPath =
    typeof path === "string" && path.trim().length > 0 ? path : "/";
  const merged = { path: normalisedPath, ...meta };
  track("page_view", merged);
}

/**
 * Convenience helpers for ads.
 * These are used by various ad components via AdGate/useAds.
 */

/**
 * Track an ad impression (e.g. header, side, interstitial).
 *
 * @param {string} type - placement type, e.g. "header", "side", "interstitial"
 * @param {object} meta - extra metadata (optional)
 */
export function trackAdImpression(type, meta = {}) {
  const merged = { placement: type, ...meta };
  track("ad_impression", merged);
}

/**
 * Track an ad click.
 *
 * @param {string} type - placement type, e.g. "header", "side", "interstitial"
 * @param {object} meta - extra metadata (optional)
 */
export function trackAdClick(type, meta = {}) {
  const merged = { placement: type, ...meta };
  track("ad_click", merged);
}

// --- REPLACE END ---



