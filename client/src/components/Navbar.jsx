import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { isLoggedIn, logout } = useAuth();
  const [lang, setLang] = useState(i18n.language);

  // ✅ Päivitä kieli tilaan
  useEffect(() => {
    const handleLangChange = (lng) => {
      setLang(lng);
    };
    i18n.on("languageChanged", handleLangChange);
    return () => {
      i18n.off("languageChanged", handleLangChange);
    };
  }, [i18n]);

  const toggleLanguage = () => {
    const newLang = i18n.language === "fi" ? "en" : "fi";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  const linkClass =
    "bg-white/80 text-blue-800 font-semibold px-4 py-2 rounded hover:bg-blue-200 transition text-sm text-center";

  // ✅ Kaikille näkyvät linkit
  const commonLinks = [
    { path: "/", label: t("Home") },
    { path: "/privacy", label: t("Privacy") },
  ];

  // ✅ Vierailijoille näkyvät
  const guestLinks = [
    { path: "/login", label: t("Login") },
    { path: "/register", label: t("Register") },
  ];

  // ✅ Kirjautuneille käyttäjille näkyvät
  const userLinks = [
    { path: "/discover", label: t("Discover") },
    { path: "/profile", label: t("Profile") },
    { path: "/matches", label: t("Matches") },
    { path: "/who-liked-me", label: t("Likes") },
    { path: "/map", label: t("Map") },
    { path: "/admin", label: t("Admin") },
  ];

  const allLinks = isLoggedIn
    ? [...commonLinks, ...userLinks]
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
      {/* ✅ Otsikko + kielinappi – suunta pakotettu vasemmalta oikealle */}
      <div className="flex items-center justify-center gap-4 direction-ltr">
        <h1 className="text-3xl font-bold text-white drop-shadow">
          💘 {t("site.title")}
        </h1>
        <LanguageSwitcher />
      </div>

      {/* ✅ Navigaatio-linkit */}
      <div
        className="w-full"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${allLinks.length + (isLoggedIn ? 1 : 0)}, minmax(80px, 1fr))`,
          gap: "8px",
        }}
      >
        {allLinks.map((link) => (
          <Link key={link.path} to={link.path} className={linkClass}>
            {link.label}
          </Link>
        ))}

        {isLoggedIn && (
          <button
            onClick={logout}
            className="bg-red-500 text-white font-semibold px-4 py-2 rounded hover:bg-red-600 text-sm"
          >
            {t("Logout")}
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
