// File: client/src/components/RouteInterstitial.jsx

// --- REPLACE START: every-3rd-route interstitial with safe pre/post gating, LS counter, dev override ---
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import InterstitialAd from "./InterstitialAd";
import useAds from "../hooks/useAds";
import { createLogger } from "../utils/debugLog";
const log = createLogger("RouteInterstitial");

// Persistent counter key in localStorage
const LS_ROUTE_COUNT_KEY = "ads:routeCount";

// Routes where we NEVER want to show route interstitials
const DENY_PATHS = ["/upgrade", "/settings/subscriptions"];

/**
 * Read route-change count from localStorage.
 */
function readRouteCount() {
  try {
    const raw = localStorage.getItem(LS_ROUTE_COUNT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Write route-change count to localStorage.
 */
function writeRouteCount(n) {
  try {
    localStorage.setItem(LS_ROUTE_COUNT_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/**
 * Increment counter and return the NEW value.
 */
function bumpRouteCount() {
  const cur = readRouteCount();
  const next = cur + 1;
  writeRouteCount(next);
  return next;
}

/**
 * Check if a given pathname is in deny list.
 * We treat an exact match or a sub-path (e.g. /settings/subscriptions/details) as denied.
 */
function isDeniedPath(pathname) {
  if (!pathname) return false;
  return DENY_PATHS.some((base) => pathname === base || pathname.startsWith(base + "/"));
}

/**
 * RouteInterstitial
 * - Shows an interstitial ad on navigation, BEFORE the actual route change for
 *   normal link clicks, or AFTER a change as a fallback (e.g., back/forward/programmatic).
 * - Now throttled: **every 3rd route change** (using a LS counter).
 * - Premium/consent/etc. still respected via useAds(); DEV override can force open.
 *
 * Counter policy (exactly-once per route change):
 * - For pre-nav interception: bump counter right before we call navigate(pendingPath)
 *   inside onClose(). Post-nav opening is suppressed.
 * - For post-nav fallback: bump counter immediately on detecting a path change,
 *   then open if `(count % 3) === 0` (and no modal/pending path).
 */
export default function RouteInterstitial({
  debug = false,
  ariaLabel = "Advertisement",
  delayMs = 0,
}) {
  const ads = useAds();
  const location = useLocation();
  const navigate = useNavigate();

  // --- state & refs ---
  const [open, setOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);

  const prevPathRef = useRef(location.pathname);
  const portalRef = useRef(null);

  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Post-nav suppression after we ourselves navigate
  const suppressNextPathOpenRef = useRef(false);

  // Avoid intercepting our own programmatic navigate()
  const programmaticNavRef = useRef(false);

  // DEV: force show if ads:forceInterstitial === "1"
  const devForced = !!(
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    localStorage.getItem("ads:forceInterstitial") === "1"
  );

  // --- ensure portal root exists ---
  useEffect(() => {
    let el = document.getElementById("route-interstitial-root");
    let created = false;

    if (!el) {
      el = document.createElement("div");
      el.id = "route-interstitial-root";
      el.setAttribute("data-created-by", "RouteInterstitial");
      document.body.appendChild(el);
      created = true;
      if (debug) console.info("[RouteInterstitial] created portal root #route-interstitial-root");
    }

    portalRef.current = el;

    return () => {
      if (created && el && el.parentNode && el.childElementCount === 0) {
        el.parentNode.removeChild(el);
        if (debug) console.info("[RouteInterstitial] removed portal root");
      }
    };
  }, [debug]);

  // Helper: should we open given the NEXT route change?
  // When pre-nav intercepting, we haven't bumped yet, so check (current+1)%3===0.
  const shouldOpenNextChange = () => {
    if (devForced) return true;
    const allow = !!ads?.canShow?.interstitial;
    if (!allow) return false;
    const next = readRouteCount() + 1;
    return next % 3 === 0;
  };

  // Helper: should we open for an ALREADY completed path change (post-nav)?
  const shouldOpenThisChange = () => {
    if (devForced) return true;
    const allow = !!ads?.canShow?.interstitial;
    if (!allow) return false;
    const cur = readRouteCount(); // already bumped in post-nav effect below
    return cur % 3 === 0;
  };

  // --- PRE-NAV GUARD: capture internal <a> clicks and gate navigation ---
  useEffect(() => {
    const isModifiedClick = (e) =>
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

    const sameOrigin = (href) => {
      try {
        const u = new URL(href, window.location.href);
        return u.origin === window.location.origin;
      } catch {
        return false;
      }
    };

    const isInternalPath = (href) => {
      try {
        const u = new URL(href, window.location.href);
        return sameOrigin(href) && u.pathname.startsWith("/");
      } catch {
        return href.startsWith("/");
      }
    };

    const handler = (e) => {
      if (programmaticNavRef.current) return;
      if (openRef.current) return;

      const anchor = e.target?.closest?.("a[href]");
      if (!anchor) return;

      // Ignore clicks inside the modal portal
      if (anchor.closest("#route-interstitial-root")) return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      if (!isInternalPath(href)) return; // external
      if (isModifiedClick(e)) return;
      if (anchor.getAttribute("target") === "_blank") return;

      // Resolve the target pathname for denyPaths check
      let targetPathname = href;
      try {
        const u = new URL(href, window.location.href);
        targetPathname = u.pathname || href;
      } catch {
        // keep href as-is for simple "/path" cases
      }

      // If either the current path OR the target path is in deny list, never gate this navigation
      const currentPath = window.location?.pathname || "";
      if (isDeniedPath(targetPathname) || isDeniedPath(currentPath)) {
        if (debug) {
          console.info("[RouteInterstitial] denyPaths skip for pre-nav", {
            currentPath,
            targetPathname,
          });
        }
        return;
      }

      const allowNow = shouldOpenNextChange();
      if (!allowNow) return;

      e.preventDefault();
      e.stopPropagation();

      // Mark that we have a pre-nav pending navigation; post-nav must NOT open this time.
      setPendingPath(href);
      suppressNextPathOpenRef.current = true;

      const openNow = () => {
        if (debug) {
          console.info("[RouteInterstitial] pre-nav opening for href:", href, {
            nextCountPreview: readRouteCount() + 1,
            devForced,
          });
        }
        setOpen(true);
      };
      delayMs > 0 ? setTimeout(openNow, delayMs) : openNow();
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads?.canShow?.interstitial, delayMs, debug, devForced]);

  // --- POST-NAV FALLBACK: open on route change (back/forward/push) ---
  useEffect(() => {
    const changed = location.pathname !== prevPathRef.current;
    if (!changed) return;

    const prevPath = prevPathRef.current;
    const newPath = location.pathname;

    // Update previous path to the new one
    prevPathRef.current = newPath;

    // Never open interstitial on deny paths (and do not bump the counter for them)
    // If either the previous OR the new path is in deny list, we skip completely.
    if (isDeniedPath(newPath) || isDeniedPath(prevPath)) {
      if (debug) {
        console.info("[RouteInterstitial] denyPaths skip for post-nav", {
          prevPath,
          newPath,
        });
      }
      return;
    }

    // If a modal is already open OR we have a pre-nav pending path, never open via fallback.
    if (openRef.current || pendingPath) {
      if (debug) {
        console.info("[RouteInterstitial] skip post-nav (open or pendingPath present)", {
          open: openRef.current,
          pendingPath,
        });
      }
      return;
    }

    if (suppressNextPathOpenRef.current) {
      // One-time suppression (set during pre-nav or right before our navigate())
      suppressNextPathOpenRef.current = false;
      if (debug) console.info("[RouteInterstitial] suppressed post-nav opening");
      return;
    }

    // We just completed a route change initiated outside our pre-nav guard.
    // Bump the counter NOW to represent this change, then decide to open.
    const newCount = bumpRouteCount();
    if (debug) console.info("[RouteInterstitial] post-nav: bumped route count ->", newCount);

    const tryOpen = () => {
      if (shouldOpenThisChange()) {
        if (debug) {
          console.info("[RouteInterstitial] post-nav opening for path:", newPath, {
            count: readRouteCount(),
            devForced,
          });
        }
        setOpen(true);
      } else if (debug) {
        console.info("[RouteInterstitial] post-nav not opening (gate/counter)");
      }
    };

    delayMs > 0 ? setTimeout(tryOpen, delayMs) : tryOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, ads?.canShow?.interstitial, delayMs, debug, devForced, pendingPath]);

  // --- close handler: continue pending navigation if any ---
  const onClose = () => {
    if (debug) console.info("[RouteInterstitial] closed");
    setOpen(false);

    if (pendingPath) {
      // This navigation counts as a route change: bump BEFORE navigate().
      const newCount = bumpRouteCount();
      if (debug) {
        console.info(
          "[RouteInterstitial] pre-nav path navigate(): bumped route count ->",
          newCount
        );
      }

      suppressNextPathOpenRef.current = true; // do not reopen after navigate()
      programmaticNavRef.current = true;
      try {
        navigate(pendingPath);
      } finally {
        programmaticNavRef.current = false;
        setPendingPath(null);
      }
    }
  };

  // --- render ---
  if (!open || !portalRef.current) return null;

  const interstitialSrc =
    import.meta.env.VITE_INTERSTITIAL_AD_SRC ||
    import.meta.env.VITE_HEADER_AD_SRC ||
    "/ads/header1.png";

  const modal = (
    <InterstitialAd onClose={onClose} ariaLabel={ariaLabel}>
      <div className="flex flex-col items-center gap-4">
        <img
          src={interstitialSrc}
          alt="Interstitial advertisement"
          className="max-h-[60vh] w-auto rounded-lg"
          onError={(e) => {
            const fallback = import.meta.env.VITE_HEADER_AD_SRC || "/ads/header1.png";
            if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-300"
          aria-label="Close interstitial advertisement"
        >
          Continue
        </button>
      </div>
    </InterstitialAd>
  );

  return createPortal(modal, portalRef.current);
}
// --- REPLACE END ---


