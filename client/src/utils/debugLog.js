// File: client/src/utils/debugLog.js

// --- REPLACE START: tiny DEV-only logger (namespaced, zero cost in prod) ---
/**
 * DEV-only logging helpers.
 *
 * Usage:
 *   import { dlog, dinfo, dwarn, derror, createLogger } from "@/utils/debugLog";
 *   dlog("route", "mounted", { path: "/discover" });
 *   const log = createLogger("useAds");
 *   log.info("state", snapshot);
 *
 * Logging happens ONLY when:
 *   - import.meta.env.DEV === true, AND
 *   - (window.__DEBUG__ === true OR localStorage['debug:all']==='1' OR localStorage['debug:<ns>']==='1')
 *
 * Nothing is emitted in production builds.
 */

const isDev = !!(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV);

/** Returns true if logs for this namespace should be printed. */
function enabled(ns = "") {
  if (!isDev) return false;
  try {
    if (typeof window !== "undefined" && window.__DEBUG__ === true) return true;
    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem("debug:all") === "1") return true;
      if (ns && localStorage.getItem(`debug:${ns}`) === "1") return true;
    }
  } catch {
    /* ignore access errors (privacy modes) */
  }
  return false;
}

/** Format namespace prefix (e.g., [useAds]) */
function tag(ns) {
  return ns ? `[${ns}]` : "";
}

/** Core printer with console fallback */
function printer(level, ns, args) {
  if (!enabled(ns)) return;
  const prefix = tag(ns);
  // eslint-disable-next-line no-console
  (console[level] || console.log)(prefix, ...args);
}

/** Shorthand APIs */
export function dlog(ns, ...args) {
  printer("log", ns, args);
}
export function dinfo(ns, ...args) {
  printer("info", ns, args);
}
export function dwarn(ns, ...args) {
  printer("warn", ns, args);
}
export function derror(ns, ...args) {
  printer("error", ns, args);
}

/**
 * Namespaced logger factory:
 *   const log = createLogger("RouteInterstitial");
 *   log.info("opening", { path });
 */
export function createLogger(ns) {
  return {
    log: (...args) => dlog(ns, ...args),
    info: (...args) => dinfo(ns, ...args),
    warn: (...args) => dwarn(ns, ...args),
    error: (...args) => derror(ns, ...args),
    /** expose check so callers can branch without computing heavy payloads */
    enabled: () => enabled(ns),
  };
}
// --- REPLACE END ---
