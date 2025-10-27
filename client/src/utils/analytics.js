// --- REPLACE START: tiny analytics facade (swap later to GA/Amplitude/own API) ---
/**
 * track(event, payload?)
 *  - event: string (e.g. "ad_impression", "ad_click")
 *  - payload: object (any serializable metadata)
 */
export function track(event, payload = {}) {
  try {
    // Keep logs compact but informative in dev
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${event}`, payload);
  } catch {
    /* noop */
  }
}

/**
 * Convenience helpers for ads.
 */
export function trackAdImpression(type, meta = {}) {
  track("ad_impression", { type, ...meta });
}

export function trackAdClick(type, meta = {}) {
  track("ad_click", { type, ...meta });
}
// --- REPLACE END ---
