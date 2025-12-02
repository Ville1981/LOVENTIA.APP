// --- REPLACE START: add reactive Premium badge + Premium Hub link + wrapped nav row ---
import React, { useCallback } from "react";
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
 * - NEW: Nav buttons wrap to 2 rows if needed instead of overflowing.
 */
const Navbar = () => {
  const { t } = useTranslation();
  const { user, bootstrapped } = useAuth();

  // Role & subscription flags
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";
  const isPremium = Boolean(user?.isPremium ?? user?.premium);

  // Shared classes for consistency
  const linkClass =
    "bg-white/10 text-white font-semibold px-4 py-2 rounded hover:bg-blue-500 transition text-sm text-center shadow backdrop-blur inline-flex items-center justify-center min-w-[110px]";

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
  const premiumHubLinks = isPremium
    ? [{ path: "/premium", key: "common:nav.premiumHub" }]
    : [];

  // Only allow admin if role matches
  const filteredUserLinks = userLinks.filter(
    (link) => link.path !== "/admin" || isAdmin
  );

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

  return (
    <>
      <nav
        className="w-full shadow mb-0"
        style={{
          backgroundImage: 'url("/NavbarImage.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: "12px 1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "160px",
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
          <label
            htmlFor="language-switcher"
            className="text-white font-medium mr-2 text-sm"
          >
            {translateNav("common:select_language_label")}
          </label>
          {/* The switcher manages its own state; id for a11y association */}
          <LanguageSwitcher id="language-switcher" />
        </div>

        {/* Links row – wraps to 2 rows if needed, centered */}
        <div className="w-full max-w-6xl mt-4">
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
      </nav>

      {/* Global header promo just under the navbar */}
      {/* Keep full-width header banner (no max-w clamp) */}
      <HeaderAdSlot className="w-full px-0" />
    </>
  );
};

export default Navbar;
// --- REPLACE END ---


