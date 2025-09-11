// File: client/src/components/HeroSection.jsx
// --- REPLACE START: rotate localized hero lines from etusivu.heroTekstit.[0..2] and refresh on language change ---
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./HeroSection.css";

/**
 * NOTE ABOUT IMAGES
 * ---------------
 * We keep the existing image list and the slide CSS.
 * Rotation cadence stays at 5s (same as before) and text rotation
 * is coupled to the same timer, so image+text advance together.
 */
const images = ["/hero.jpg", "/hero1.jpg", "/hero2.jpg", "/hero3.jpg", "/hero4.jpg"];

function HeroSection() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const { t, i18n } = useTranslation();

  /**
   * (Historical context, kept to preserve file shape/length and avoid regressions)
   * We previously experimented with language buckets and alternative copy sets.
   * Keeping the arrays below harms nothing and can be re-used later if we need
   * to branch per-locale. These DO NOT affect the current text selection logic.
   */
  const latinLangs = ["es-ES", "es-MX", "es-AR", "es-CO"];
  const modernLangs = ["it", "pl", "sw"];
  const useModernText =
    modernLangs.includes(i18n.language) ||
    (!latinLangs.includes(i18n.language) && i18n.language !== "en");

  /**
   * TEXT KEYS (STABLE API)
   * ----------------------
   * We now rely on 3 leaf keys per locale, accessed with dot-index syntax:
   *   etusivu.heroTekstit.0
   *   etusivu.heroTekstit.1
   *   etusivu.heroTekstit.2
   *
   * This guarantees t(...) returns a STRING (never an object), which fixes the
   * "Objects are not valid as a React child" crash. If any key is missing,
   * defaultValue is used (English copy), so UI stays functional.
   */
  const textKeys = useMemo(
    () => ["etusivu.heroTekstit.0", "etusivu.heroTekstit.1", "etusivu.heroTekstit.2"],
    []
  );

  /**
   * Resolve the actual visible strings via i18n for the CURRENT language.
   * We recompute whenever i18n.language changes.
   */
  const heroLines = useMemo(
    () => [
      t(textKeys[0], { defaultValue: "Find love that lasts." }),
      t(textKeys[1], { defaultValue: "Meet people who share your values." }),
      t(textKeys[2], { defaultValue: "Your next match is one click away." }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language, textKeys]
  );

  /**
   * TIMER: advance both image and text every 5 seconds.
   * We reset the timer whenever the language changes so that the newly
   * resolved heroLines are displayed immediately and in sync.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      setCurrentTextIndex((prev) => (prev === heroLines.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(interval);
  }, [heroLines.length, i18n.language]);

  /**
   * When the user changes language mid-rotation, keep the same text index if possible.
   * If the target language has fewer lines (shouldn't happen, but safe), clamp the index.
   */
  useEffect(() => {
    setCurrentTextIndex((idx) => (idx >= heroLines.length ? 0 : idx));
  }, [heroLines.length]);

  // Ensure compatibility with tests/runtimes where i18n.dir might be missing
  const dir = typeof i18n?.dir === "function" ? i18n.dir() : "ltr";

  return (
    <div className="hero-section-container">
      <div className="hero-section">
        {/* Background slides */}
        {images.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={
              // Use a generic localized alt; no objects, always a string
              t("common:heroImageAlt", { defaultValue: `Hero ${index + 1}` })
            }
            className={`hero-slide ${index === currentImageIndex ? "active" : ""}`}
          />
        ))}

        {/* Text overlay — respects RTL languages */}
        <div className={`hero-overlay ${dir === "rtl" ? "rtl-align" : "left"}`}>
          <h1 dir={dir}>
            {heroLines[currentTextIndex]}
          </h1>
        </div>
      </div>
    </div>
  );
}

export default HeroSection;
// --- REPLACE END ---
