// PATH: client/src/components/Navbar.jsx

import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import HeaderAdSlot from "./HeaderAdSlot";
import LanguageSwitcher from "./LanguageSwitcher";
// Replaced component-based logout with direct hook usage for immediate client cleanup
import { useLogout } from "../auth/useLogout";
import { useAuth } from "../contexts/AuthContext";

/**
 * Navbar
 * - Reads auth state from AuthContext (user + bootstrapped)
 * - Uses i18n t('common:nav.*') keys for all link labels
 * - IMPORTANT: do NOT compute translated labels inside static arrays.
 *   Keep only {path,key} and call t(key) at render time so language changes re-render correctly.
 * - Provides defaultValue fallbacks so raw keys never leak to UI.
 * - Shows guest links until bootstrapping finishes, then user/admin links.
 * - Shows a reactive “Premium” badge the moment the status flips (isPremium/premium).
 * - Premium users also get a direct “Premium Hub” link (/premium).
 *
 * PERFORMANCE NOTE (IMPORTANT)
 * ---------------------------
 * Lighthouse desktop showed the navbar (with background image) as the LCP element.
 * NavbarImage.png is large and can delay LCP heavily under throttling.
 *
 * We keep the desktop navbar image, BUT we:
 * 1) Paint an instant lightweight placeholder (CSS gradient) for first paint/LCP, and
 * 2) Defer loading/decoding the hero background until the browser is idle (desktop-only), then swap it in.
 *
 * NEW (FORMAT OPTIMIZATION)
 * -------------------------
 * Once the background is ready, we prefer CSS image-set(AVIF/WebP/PNG) so modern browsers can select
 * a smaller format. IMPORTANT: We do this in a way that does NOT change the final look/size/position.
 *
 * VERY IMPORTANT VISUAL GUARANTEE
 * -------------------------------
 * If AVIF/WebP files are not present yet, we automatically fall back to the existing PNG, so the
 * forest background never “disappears” or changes.
 *
 * CLS NOTE (IMPORTANT)
 * --------------------
 * HeaderAdSlot below the navbar can cause CLS if its height changes after images load.
 * We reserve space for it using a stable wrapper minHeight.
 *
 * LAYOUT NOTE (IMPORTANT)
 * ----------------------
 * The hero-style navbar background image should NOT "grow taller" when nav buttons wrap.
 * To keep the background image in the intended proportions, the hero area is fixed-height.
 *
 * VISUAL NOTE (IMPORTANT)
 * ----------------------
 * The nav buttons should visually span the navbar + the header ad (like the older layout):
 * - The first row appears over the navbar background.
 * - Any wrapped row(s) can flow over the header ad background (no separate bar component).
 * This is implemented by rendering the buttons in a single overlay block that straddles the boundary.
 */
const Navbar = () => {
  const { t } = useTranslation();
  const { user, bootstrapped } = useAuth();

  // Role & subscription flags
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";
  const isPremium = Boolean(user?.isPremium ?? user?.premium);

  /**
   * Desktop-only background image toggle
   * -----------------------------------
   * We avoid fetching NavbarImage.* on mobile to keep mobile lightweight.
   * This is reactive, so resizing from mobile -> desktop will enable it.
   */
  const [useDesktopBackground, setUseDesktopBackground] = useState(false);

  useEffect(() => {
    // Guard for non-browser/test environments (should still be fine in Vite, but safe)
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    // Tailwind md breakpoint is 768px by default; align with that for consistency.
    const mq = window.matchMedia("(min-width: 768px)");

    const apply = (e) => {
      // Prefer event.matches, fall back to mq.matches
      const next = Boolean(e?.matches ?? mq.matches);
      setUseDesktopBackground(next);
    };

    // Set immediately on mount so first paint matches the current viewport
    apply();

    // Prefer the modern event API
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    // Fallback: use onchange if present (avoids deprecated addListener/removeListener)
    if ("onchange" in mq) {
      mq.onchange = apply;
      return () => {
        mq.onchange = null;
      };
    }

    return undefined;
  }, []);

  // Shared classes for consistency (smaller so most desktop widths stay on one row)
  // --- REPLACE START: make nav buttons more compact to fit better on one row ---
  const linkClass =
    "bg-white/10 text-white font-semibold px-3 py-2 rounded hover:bg-blue-500 transition text-sm text-center shadow backdrop-blur inline-flex items-center justify-center min-w-[96px]";
  // --- REPLACE END ---

  // --- REPLACE START: CLS-safe reservation values for below-navbar banner slot ---
  // Keep this aligned with HeaderAdSlot (clamp up to ~150px) + a small safety margin.
  // If HeaderAdSlot is fully removed in the future, this wrapper can be removed as well.
  const HEADER_AD_RESERVED_HEIGHT_PX = 160; // max banner ~150px + ~10px safety
  // --- REPLACE END ---

  // --- REPLACE START: LCP-friendly desktop navbar background swap using image-set (AVIF/WebP/PNG) ---
  // Instant placeholder for first paint: avoids waiting for a large image to download/paint.
  // The real desktop background image is swapped in later, once loaded/decoded (desktop-only).
  const NAV_BG_PLACEHOLDER =
    "linear-gradient(135deg, rgba(2,6,23,0.92), rgba(30,58,138,0.60))";

  // CSS image-set for modern formats. Visual output stays the same (cover/center),
  // but transfer size can drop significantly on desktop.
  //
  // We include vendor-prefixed WebKit image-set for Safari compatibility.
  const NAV_BG_IMAGESET = `image-set(
    url("/NavbarImage.avif") type("image/avif"),
    url("/NavbarImage.webp") type("image/webp"),
    url("/NavbarImage.png") type("image/png")
  )`;

  const NAV_BG_WEBKIT_IMAGESET = `-webkit-image-set(
    url("/NavbarImage.avif") type("image/avif"),
    url("/NavbarImage.webp") type("image/webp"),
    url("/NavbarImage.png") type("image/png")
  )`;

  const [isNavbarBgReady, setIsNavbarBgReady] = useState(false);

  // Tracks what we should paint once ready:
  // - "imageset" => use image-set (AVIF/WebP/PNG candidates)
  // - "png"      => use url("/NavbarImage.png") only (guarantees forest background, no missing assets)
  const [navbarBgMode, setNavbarBgMode] = useState("png");

  /**
   * Pick the best single asset URL for preloading/decoding.
   * - Prefer AVIF, then WebP, then PNG.
   * - Detection uses CSS.supports where available; fallback is PNG.
   *
   * NOTE: We still verify the file actually loads; if it fails (missing file), we fall back to PNG,
   * so the background NEVER disappears.
   */
  const pickBestNavbarAsset = useCallback(() => {
    try {
      // Guard (SSR/tests)
      if (typeof window === "undefined") return { href: "/NavbarImage.png", type: "image/png" };

      const supports = typeof window.CSS !== "undefined" && typeof window.CSS.supports === "function";

      if (supports) {
        const avifOk = window.CSS.supports(
          "background-image",
          'image-set(url("x.avif") type("image/avif"))'
        );
        if (avifOk) return { href: "/NavbarImage.avif", type: "image/avif", mode: "imageset" };

        const webpOk = window.CSS.supports(
          "background-image",
          'image-set(url("x.webp") type("image/webp"))'
        );
        if (webpOk) return { href: "/NavbarImage.webp", type: "image/webp", mode: "imageset" };
      }
    } catch {
      // If detection fails, fall back to PNG.
    }

    return { href: "/NavbarImage.png", type: "image/png", mode: "png" };
  }, []);

  /**
   * Optional lightweight preload:
   * - Keep default OFF to avoid extra requests while you are still adding AVIF/WebP files.
   * - When you enable it, it will preload the chosen single file (not image-set).
   */
  const ENABLE_NAV_BG_PRELOAD = false;

  useEffect(() => {
    // Only load the heavy navbar background on desktop viewports.
    if (!useDesktopBackground) {
      setIsNavbarBgReady(false);
      setNavbarBgMode("png");
      return undefined;
    }

    // Guard for non-browser/test environments
    if (typeof window === "undefined") {
      setIsNavbarBgReady(false);
      setNavbarBgMode("png");
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const ensurePreloadLink = ({ href, type }) => {
      if (!ENABLE_NAV_BG_PRELOAD) return;
      if (typeof document === "undefined") return;

      // Prevent duplicates by ID.
      const id = "nav-bg-preload";
      if (document.getElementById(id)) return;

      const link = document.createElement("link");
      link.id = id;
      link.rel = "preload";
      link.as = "image";
      link.href = href;

      // Some browsers use type for preload correctness; safe to set.
      if (type) link.type = type;

      document.head.appendChild(link);
    };

    const loadOne = ({ href }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = href;

        const done = (ok) => resolve(Boolean(ok));

        const finalize = async () => {
          try {
            if (typeof img.decode === "function") await img.decode();
          } catch {
            // Ignore decode errors; onload was already successful.
          }
          done(true);
        };

        if (img.complete) {
          finalize();
        } else {
          img.onload = () => finalize();
          img.onerror = () => done(false);
        }
      });
    };

    const startLoad = async () => {
      if (cancelled) return;

      // Try best format first, but GUARANTEE fallback to PNG if missing.
      const chosen = pickBestNavbarAsset();
      ensurePreloadLink(chosen);

      // 1) Try chosen (avif/webp/png)
      const okChosen = await loadOne(chosen);
      if (cancelled) return;

      if (okChosen) {
        setNavbarBgMode(chosen.mode || "png");
        setIsNavbarBgReady(true);
        return;
      }

      // 2) Fallback to PNG (must exist)
      const okPng = await loadOne({ href: "/NavbarImage.png" });
      if (cancelled) return;

      setNavbarBgMode("png");
      setIsNavbarBgReady(Boolean(okPng));
    };

    /**
     * IMPORTANT:
     * Defer the heavy background fetch/paint until idle so Lighthouse doesn't "lock" LCP to it.
     * This keeps the initial paint fast and stable (placeholder), while still enabling the image.
     */
    const ric = window.requestIdleCallback;
    const cic = window.cancelIdleCallback;

    if (typeof ric === "function") {
      idleId = ric(
        () => {
          startLoad();
        },
        { timeout: 2500 }
      );
    } else {
      // Fallback: small delay (keeps first paint fast, then loads shortly after)
      timeoutId = window.setTimeout(() => {
        startLoad();
      }, 1200);
    }

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (idleId && typeof cic === "function") {
        cic(idleId);
        idleId = null;
      }
    };
  }, [useDesktopBackground, pickBestNavbarAsset]);
  // --- REPLACE END ---

  /**
   * Default English labels for safety (used only as fallbacks).
   */
  const defaults = {
    "common:nav.home": "Home",
    "common:nav.privacy": "Privacy",
    "common:nav.login": "Login",
    "common:nav.register": "Register",
    "common:nav.discover": "Discover",
    "common:nav.profile": "Profile",
    "common:nav.matches": "Matches",
    "common:nav.messages": "Messages",
    "common:nav.likes": "Likes",
    "common:nav.map": "Map",
    "common:nav.premium": "Premium",
    "common:nav.premiumHub": "Premium Hub",
    "common:nav.settings": "Settings",
    "common:nav.admin": "Admin",
    "common:nav.logout": "Logout",
    // Badge fallback
    "common:badge.premium": "Premium",
    // Misc labels
    "common:site.title": "Loventia",
    "common:select_language_label": "Language",
  };

  /**
   * Helper: keep translation safe.
   * If i18n returns the key itself, fall back to an English default label.
   */
  const translateNav = useCallback(
    (key) => {
      const raw = t(key);
      const bareKey = key.includes(":") ? key.split(":").slice(-1)[0] : key;

      if (!raw || raw === key || raw === bareKey) {
        return defaults[key] || bareKey;
      }

      return raw;
    },
    [t]
  );

  // NOTE: keep only keys here, no t(...) calls inside arrays so language switches live-update
  // Always visible
  const commonLinks = [
    { path: "/", key: "common:nav.home" },
    { path: "/privacy", key: "common:nav.privacy" },
  ];

  // Guest-only
  const guestLinks = [
    { path: "/login", key: "common:nav.login" },
    { path: "/register", key: "common:nav.register" },
  ];

  // Authenticated user base links
  const userLinks = [
    { path: "/discover", key: "common:nav.discover" },
    { path: "/profile", key: "common:nav.profile" },
    { path: "/matches", key: "common:nav.matches" },
    { path: "/messages", key: "common:nav.messages" },
    // Likes overview (outgoing, incoming, matches)
    { path: "/likes", key: "common:nav.likes" },
    { path: "/map", key: "common:nav.map" },
    // Upgrade/landing for Premium (works also for Premium users as a CTA/redirect)
    { path: "/upgrade", key: "common:nav.premium" },
    { path: "/settings", key: "common:nav.settings" },
    { path: "/admin", key: "common:nav.admin" },
  ];

  // Extra link only for Premium users – points to the Premium Hub
  const premiumHubLinks = isPremium ? [{ path: "/premium", key: "common:nav.premiumHub" }] : [];

  // Only allow admin if role matches
  const filteredUserLinks = userLinks.filter((link) => link.path !== "/admin" || isAdmin);

  /**
   * Behavior:
   * - While bootstrapping, show public+guest so navbar is never empty.
   * - After bootstrap:
   *   - logged in → user links (+ Premium Hub if applicable)
   *   - logged out → guest links
   */
  const linksToRender = !bootstrapped
    ? [...commonLinks, ...guestLinks]
    : isLoggedIn
    ? [...commonLinks, ...filteredUserLinks, ...premiumHubLinks]
    : [...commonLinks, ...guestLinks];

  // Hook for immediate client-side logout (clears tokens, cache, and navigates)
  const logout = useLogout();

  // --- REPLACE START: shared background values (keeps the old forest look, adds image-set when available) ---
  // IMPORTANT:
  // - Before ready: placeholder gradient (fast first paint)
  // - After ready:
  //   - If AVIF/WebP loaded OK => use image-set (browser selects best)
  //   - Else => use PNG directly (guarantees the old forest background)
  const navBgImage = useDesktopBackground
    ? isNavbarBgReady
      ? navbarBgMode === "imageset"
        ? NAV_BG_IMAGESET
        : 'url("/NavbarImage.png")'
      : NAV_BG_PLACEHOLDER
    : "none";

  const navBgWebkitImage = useDesktopBackground
    ? isNavbarBgReady
      ? navbarBgMode === "imageset"
        ? NAV_BG_WEBKIT_IMAGESET
        : 'url("/NavbarImage.png")'
      : NAV_BG_PLACEHOLDER
    : "none";
  // --- REPLACE END ---

  // --- REPLACE START: make a single overlay block that straddles navbar + header ad like before ---
  // This pulls the button block upward into the navbar area and also lets it flow downward over the header ad.
  // On small screens, keep it in normal flow (no overlap) to avoid awkward stacking.
  const NAV_LINKS_OVERLAP_PX = 54; // tuned for the 160px hero height and typical button row height
  const navLinksOverlayStyle = {
    position: "relative",
    zIndex: 30, // above HeaderAdSlot content
    marginTop: useDesktopBackground ? `-${NAV_LINKS_OVERLAP_PX}px` : "0px",
    marginBottom: useDesktopBackground ? `-${NAV_LINKS_OVERLAP_PX}px` : "0px",
    padding: "0 1rem",
  };
  // --- REPLACE END ---

  return (
    <>
      {/* --- REPLACE START: hero navbar (fixed height) - no separate "links bar" component --- */}
      <nav
        className="w-full shadow mb-0"
        style={{
          // Desktop-only: keep the image, but avoid making it block LCP.
          // First paint uses a lightweight placeholder; then we swap in the real image once ready.
          backgroundImage: navBgImage,
          WebkitBackgroundImage: navBgWebkitImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          // Solid fallback in case gradients/images are disabled
          backgroundColor: "#0b1220",
          padding: "12px 1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "160px", // fixed hero height so background image stays in the intended proportions
          justifyContent: "start",
        }}
      >
        {/* Title row */}
        <div className="flex items-center justify-center w-full max-w-6xl">
          <h1 className="text-3xl font-bold text-white drop-shadow flex items-center">
            {/* Site title */}
            💗 {translateNav("common:site.title")}

            {/* Reactive Premium badge next to title */}
            {isLoggedIn && isPremium && (
              <span
                className="ml-3 inline-flex items-center gap-1 rounded-full bg-yellow-400/95 text-black text-xs font-extrabold px-3 py-1 shadow ring-1 ring-black/10"
                aria-label={translateNav("common:badge.premium")}
                title={translateNav("common:badge.premium")}
              >
                <span aria-hidden="true">👑</span>
                {translateNav("common:badge.premium")}
              </span>
            )}
          </h1>
        </div>

        {/* Language selector row */}
        <div className="flex items-center justify-center w-full max-w-6xl mt-2">
          <label htmlFor="language-switcher" className="text-white font-medium mr-2 text-sm">
            {translateNav("common:select_language_label")}
          </label>
          {/* The switcher manages its own state; id for a11y association */}
          <LanguageSwitcher id="language-switcher" />
        </div>
      </nav>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: single overlay nav links block (spans navbar + header ad) --- */}
      <div className="w-full" style={navLinksOverlayStyle}>
        <div className="mx-auto w-full max-w-6xl">
          {/* Keep transparent container so underlying navbar/header-ad imagery shows through */}
          <div className="flex flex-wrap justify-center gap-2">
            {linksToRender.map((link) => (
              <Link key={link.path} to={link.path} className={linkClass}>
                {translateNav(link.key)}
              </Link>
            ))}

            {/* Logout visible only if logged in and bootstrapped */}
            {isLoggedIn && bootstrapped && (
              <button
                type="button"
                onClick={logout}
                className={linkClass}
                aria-label={translateNav("common:nav.logout")}
                title={translateNav("common:nav.logout")}
              >
                {translateNav("common:nav.logout")}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* --- REPLACE END --- */}

      {/* --- REPLACE START: reserve stable space for HeaderAdSlot to prevent CLS --- */}
      <div
        className="w-full"
        style={{
          // Keep a stable block so the page does not jump while the header banner image loads.
          minHeight: `${HEADER_AD_RESERVED_HEIGHT_PX}px`,
          // Ensure the ad can sit behind the overlay links block.
          position: "relative",
          zIndex: 0,
        }}
      >
        {/* Global header promo just under the navbar */}
        {/* Keep full-width header banner (no max-w clamp) */}
        <HeaderAdSlot className="w-full px-0" />
      </div>
      {/* --- REPLACE END --- */}
    </>
  );
};

export default Navbar;


