// --- REPLACE START: read auth from AuthContext.user + bootstrapped ---
import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import LanguageSwitcher from "./LanguageSwitcher";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../contexts/AuthContext";

const Navbar = () => {
  const { t } = useTranslation();
  // Use the actual fields provided by AuthContext
  const { user, bootstrapped } = useAuth();

  // Derive flags from user
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  const linkClass =
    "bg-white/10 text-white font-semibold px-4 py-2 rounded hover:bg-blue-500 transition text-sm text-center shadow backdrop-blur";

  const commonLinks = [
    { path: "/", label: t("Home") },
    { path: "/privacy", label: t("Privacy Policy") },
  ];
  const guestLinks = [
    { path: "/login", label: t("Login") },
    { path: "/register", label: t("Register") },
  ];
  const userLinks = [
    { path: "/discover", label: t("Discover") },
    { path: "/profile", label: t("Profile") },
    { path: "/matches", label: t("Matches") },
    { path: "/messages", label: t("Messages") },
    { path: "/who-liked-me", label: t("Likes") },
    { path: "/map", label: t("Map") },
    { path: "/upgrade", label: t("Premium") },
    { path: "/settings", label: t("Settings") },
    { path: "/admin", label: t("Admin") },
  ];
  const filteredUserLinks = userLinks.filter(
    (link) => link.path !== "/admin" || isAdmin
  );
  const linksToRender = isLoggedIn
    ? [...commonLinks, ...filteredUserLinks]
    : [...commonLinks, ...guestLinks];

  // Avoid flicker: don’t render links until auth bootstrap is done
  if (!bootstrapped) {
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
        <div className="flex items-center justify-center w-full max-w-6xl">
          <h1 className="text-3xl font-bold text-white drop-shadow">
            💘 {t("site.title")}
          </h1>
        </div>
        <div className="flex items-center justify-center w-full max-w-6xl mt-2">
          <label
            htmlFor="language-switcher"
            className="text-white font-medium mr-2 text-sm"
          >
            {t("select_language_label")}
          </label>
          <LanguageSwitcher id="language-switcher" />
        </div>
      </nav>
    );
  }

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
        height: "160px", // slightly taller to fit new row
        justifyContent: "start", // stack rows top-down
      }}
    >
      {/* Title row */}
      <div className="flex items-center justify-center w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-white drop-shadow">
          💘 {t("site.title")}
        </h1>
      </div>

      {/* Language selector row */}
      <div className="flex items-center justify-center w-full max-w-6xl mt-2">
        <label
          htmlFor="language-switcher"
          className="text-white font-medium mr-2 text-sm"
        >
          {t("select_language_label")}
        </label>
        <LanguageSwitcher id="language-switcher" />
      </div>

      {/* Navigation links grid */}
      <div
        className="w-full max-w-6xl mt-4"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${
            linksToRender.length + (isLoggedIn ? 1 : 0)
          }, minmax(80px, 1fr))`,
          gap: "8px",
        }}
      >
        {linksToRender.map((link) => (
          <Link key={link.path} to={link.path} className={linkClass}>
            {link.label}
          </Link>
        ))}

        {isLoggedIn && <LogoutButton />}
      </div>
    </nav>
  );
};

export default Navbar;
// --- REPLACE END ---
