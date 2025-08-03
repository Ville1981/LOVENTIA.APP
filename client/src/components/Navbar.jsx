// src/components/Navbar.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LogoutButton from "../components/LogoutButton";

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { isLoggedIn, isAdmin } = useAuth();
  const [lang, setLang] = useState(i18n.language);

  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on("languageChanged", handleLangChange);
    return () => i18n.off("languageChanged", handleLangChange);
  }, [i18n]);

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
        height: "160px",               // slightly taller to fit new row
        justifyContent: "start",       // stack rows top-down
      }}
    >
      {/* Title row */}
      <div className="flex items-center justify-center w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-white drop-shadow">
          💘 {t("site.title")}
        </h1>
      </div>

      {/* --- REPLACE START: new centered label + full selector --- */}
      <div className="flex items-center justify-center w-full max-w-6xl mt-2">
        <label
          htmlFor="language-switcher"
          className="text-white font-medium mr-2 text-sm"
        >
          Select Language:
        </label>
        <LanguageSwitcher id="language-switcher" />
      </div>
      {/* --- REPLACE END --- */}

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
