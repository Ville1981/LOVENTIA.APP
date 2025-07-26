import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LogoutButton from "../components/LogoutButton"; // --- REPLACE START: import LogoutButton component ---
// --- REPLACE END ---

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { isLoggedIn, isAdmin } = useAuth(); // --- REPLACE START: remove logout from destructure ---
  // const { isLoggedIn, isAdmin, logout } = useAuth();
  // --- REPLACE END ---
  const [lang, setLang] = useState(i18n.language);

  // Update language state on change
  useEffect(() => {
    const handleLangChange = (lng) => setLang(lng);
    i18n.on("languageChanged", handleLangChange);
    return () => i18n.off("languageChanged", handleLangChange);
  }, [i18n]);

  // Toggle between Finnish and English
  const toggleLanguage = () => {
    const newLang = i18n.language === "fi" ? "en" : "fi";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  const linkClass =
    "bg-white/10 text-white font-semibold px-4 py-2 rounded hover:bg-blue-500 transition text-sm text-center shadow backdrop-blur";

  // Links shown to all visitors
  const commonLinks = [
    { path: "/", label: t("Home") },
    { path: "/privacy", label: t("Privacy Policy") },
  ];

  // Links for unauthenticated users
  const guestLinks = [
    { path: "/login", label: t("Login") },
    { path: "/register", label: t("Register") },
  ];

  // Links for authenticated users
  const userLinks = [
    { path: "/discover", label: t("Discover") },
    { path: "/profile", label: t("Profile") },
    { path: "/matches", label: t("Matches") },
    // --- REPLACE START: Added Messages link ---
    { path: "/messages", label: t("Messages") },
    // --- REPLACE END ---
    { path: "/who-liked-me", label: t("Likes") },
    { path: "/map", label: t("Map") },
    { path: "/upgrade", label: t("Premium") },
    { path: "/settings", label: t("Settings") },
    { path: "/admin", label: t("Admin") },
  ];

  // Exclude admin if not authorized
  const filteredUserLinks = userLinks.filter(
    (link) => link.path !== "/admin" || isAdmin
  );

  // Determine final link set
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
        height: "140px",
        justifyContent: "space-between",
      }}
    >
      {/* Title and language toggle */}
      <div className="flex items-center justify-between w-full max-w-6xl">
        <h1 className="text-3xl font-bold text-white drop-shadow">
          💘 {t("site.title")}
        </h1>
        <button
          onClick={toggleLanguage}
          className="text-white border border-white px-3 py-1 rounded"
        >
          {lang === "fi" ? "EN" : "FI"}
        </button>
      </div>

      {/* Navigation links grid */}
      <div
        className="w-full max-w-6xl mt-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${linksToRender.length + (isLoggedIn ? 1 : 0)}, minmax(80px, 1fr))`,
          gap: "8px",
        }}
      >
        {linksToRender.map((link) => (
          <Link key={link.path} to={link.path} className={linkClass}>
            {link.label}
          </Link>
        ))}

        {isLoggedIn && (
          // --- REPLACE START: use LogoutButton instead of inline button ---
          <LogoutButton />
          // --- REPLACE END ---
        )}
      </div>
    </nav>
  );
};

export default Navbar;
