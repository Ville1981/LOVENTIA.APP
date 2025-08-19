import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./HeroSection.css";

const images = [
  "/hero.jpg",
  "/hero1.jpg",
  "/hero2.jpg",
  "/hero3.jpg",
  "/hero4.jpg",
];

function HeroSection() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const { t, i18n } = useTranslation();

  // Language buckets kept (not strictly needed now) to avoid future regressions
  const latinLangs = ["es-ES", "es-MX", "es-AR", "es-CO"];
  const modernLangs = ["it", "pl", "sw"];

  // --- REPLACE START -------------------------------------------------
  // Root cause: EN fell back to "hero.*" keys which do not exist.
  // Fix: always use the same 'etusivu.heroTekstit.*' keys for every language.
  // We keep the older branching variables for compatibility, but the keys
  // themselves are unified. Provide robust defaultValue fallbacks.
  const useModernText =
    modernLangs.includes(i18n.language) ||
    (!latinLangs.includes(i18n.language) && i18n.language !== "en");

  // Unified key list (same for all languages)
  const textKeys = [
    "etusivu.heroTekstit.0",
    "etusivu.heroTekstit.1",
    "etusivu.heroTekstit.2",
  ];
  // --- REPLACE END ---------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) =>
        prev === images.length - 1 ? 0 : prev + 1
      );
      setCurrentTextIndex((prev) =>
        prev === textKeys.length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [textKeys]);

  return (
    <div className="hero-section-container">
      <div className="hero-section">
        {images.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Hero ${index}`}
            className={`hero-slide ${
              index === currentImageIndex ? "active" : ""
            }`}
          />
        ))}

        <div
          className={`hero-overlay ${
            i18n.language === "ar" ? "rtl-align" : "left"
          }`}
        >
          <h1 dir={i18n.language === "ar" ? "rtl" : "ltr"}>
            {
              // --- REPLACE START: add safe fallbacks so EN (and any missing locale) shows text ---
              t(textKeys[currentTextIndex], {
                defaultValue:
                  currentTextIndex === 0
                    ? "Meet kind singles near you"
                    : currentTextIndex === 1
                    ? "Safe. Respectful. Real."
                    : "Start your story today",
              })
              // --- REPLACE END ---
            }
          </h1>
        </div>
      </div>
    </div>
  );
}

export default HeroSection;

