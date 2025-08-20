// client/src/components/Navbar.jsx

// --- REPLACE START: read auth from AuthContext.user + bootstrapped + use t('nav.*') keys ---
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import LanguageSwitcher from "./LanguageSwitcher";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../contexts/AuthContext";

/**
 * Navbar
 * - Reads auth state from AuthContext (user + bootstrapped)
 * - Uses i18n t('nav.*') keys for all labels
 * - IMPORTANT FIX: do NOT compute translated labels inside static arrays.
 *   Keep only {path,key} and call t(key) at render time so language changes re-render correctly.
 * - Provides defaultValue fallbacks so raw keys (e.g., "nav.home") never leak to UI
 * - Shows guest links until bootstrapping finishes, then user/admin links
 */
const Navbar = () => {
  const { t } = useTranslation();
  const { user, bootstrapped } = useAuth();

  // Role flags
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  // Shared classes for consistency
  const linkClass =
    "bg-white/10 text-white font-semibold px-4 py-2 rounded hover:bg-blue-500 transition text-sm text-center shadow backdrop-blur";

  /**
   * Default English labels for safety.
   * These are used only as defaultValue fallbacks so we never display raw keys.
   */
  const defaults = {
    "nav.home": "Home",
    "nav.privacy": "Privacy",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.discover": "Discover",
    "nav.profile": "Profile",
    "nav.matches": "Matches",
    "nav.messages": "Messages",
    "nav.likes": "Likes",
    "nav.map": "Map",
    "nav.premium": "Premium",
    "nav.settings": "Settings",
    "nav.admin": "Admin",
  };

  // NOTE: keep only keys here, no t(...) calls inside arrays so language switches live-update
  // Always visible
  const commonLinks = [
    { path: "/", key: "nav.home" },
    { path: "/privacy", key: "nav.privacy" },
  ];

  // Guest-only
  const guestLinks = [
    { path: "/login", key: "nav.login" },
    { path: "/register", key: "nav.register" },
  ];

  // Authenticated user
  const userLinks = [
    { path: "/discover", key: "nav.discover" },
    { path: "/profile", key: "nav.profile" },
    { path: "/matches", key: "nav.matches" },
    { path: "/messages", key: "nav.messages" },
    { path: "/who-liked-me", key: "nav.likes" },
    { path: "/map", key: "nav.map" },
    { path: "/upgrade", key: "nav.premium" },
    { path: "/settings", key: "nav.settings" },
    { path: "/admin", key: "nav.admin" },
  ];

  // Only allow admin if role matches
  const filteredUserLinks = userLinks.filter(
    (link) => link.path !== "/admin" || isAdmin
  );

  /**
   * Behavior:
   * - While bootstrapping, show public+guest so navbar is never empty
   * - After bootstrap:
   *   - logged in → user links
   *   - logged out → guest links
   */
  const linksToRender =
    !bootstrapped
      ? [...commonLinks, ...guestLinks]
      : isLoggedIn
      ? [...commonLinks, ...filteredUserLinks]
      : [...commonLinks, ...guestLinks];

  return (
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
        <h1 className="text-3xl font-bold text-white drop-shadow">
          💘 {t("site.title", { defaultValue: "Loventia" })}
        </h1>
      </div>

      {/* Language selector row */}
      <div className="flex items-center justify-center w-full max-w-6xl mt-2">
        <label
          htmlFor="language-switcher"
          className="text-white font-medium mr-2 text-sm"
        >
          {t("select_language_label", { defaultValue: "Language" })}
        </label>
        <LanguageSwitcher id="language-switcher" />
      </div>

      {/* Links row */}
      <div
        className="w-full max-w-6xl mt-4"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${
            linksToRender.length + (isLoggedIn && bootstrapped ? 1 : 0)
          }, minmax(80px, 1fr))`,
          gap: "8px",
        }}
      >
        {linksToRender.map((link) => (
          <Link key={link.path} to={link.path} className={linkClass}>
            {t(link.key, { defaultValue: defaults[link.key] || link.key })}
          </Link>
        ))}

        {/* Logout visible only if logged in and bootstrapped */}
        {isLoggedIn && bootstrapped && <LogoutButton />}
      </div>
    </nav>
  );
};

export default Navbar;
// --- REPLACE END ---
