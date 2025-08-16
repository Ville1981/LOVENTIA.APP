// File: client/src/components/LanguageSwitcher.jsx

// --- REPLACE START: persist + normalize + robust options ---
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Small helper to normalize e.g. "es-ES" -> "es"
 * Keeps our folder structure consistent with i18n init (load:"languageOnly").
 */
const toBase = (code = "") => String(code).split("-")[0];

/**
 * LanguageSwitcher component
 *
 * Provides a <select> dropdown with grouped language options.
 * - Persists choice in localStorage
 * - Normalizes codes so "en-GB" resolves to "en"
 * - Updates <html dir="ltr|rtl"> on language change
 * - Keeps dropdown in sync with i18n.language
 */
const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  /**
   * Initial value:
   * Use normalized base so dropdown always matches loaded translation file.
   * Default fallback: "fi" (Finnish).
   */
  const [value, setValue] = useState(toBase(i18n.language) || "fi");

  /**
   * Effect: update <html dir="…"> whenever language changes
   * Important for RTL languages (ar, he, ur, fa).
   */
  useEffect(() => {
    const rtl = ["ar", "he", "fa", "ur"];
    const updateDir = (lng) => {
      const base = toBase(lng);
      document.documentElement.setAttribute(
        "dir",
        rtl.includes(base) ? "rtl" : "ltr"
      );
      // keep the dropdown roughly in sync with the *current* i18n language
      setValue(base);
    };
    updateDir(i18n.language);
    i18n.on("languageChanged", updateDir);
    return () => i18n.off("languageChanged", updateDir);
  }, [i18n]);

  /**
   * changeLanguage:
   * - Normalize and persist base code in localStorage
   * - Update component state
   * - Trigger i18next to switch language using the BASE tag (crucial with load: 'languageOnly')
   */
  const changeLanguage = (lng) => {
    const base = toBase(lng);
    localStorage.setItem("language", base);
    setValue(lng); // keep the exact option the user chose visible in the <select>
    // IMPORTANT: switch i18n using the BASE language to match /locales/<lng>/translation.json
    if (i18n.language !== base) {
      i18n.changeLanguage(base);
    }
  };

  /**
   * groups:
   * Language dropdown options grouped by region.
   * Each group has label + array of {code,label}.
   */
  const groups = useMemo(
    () => [
      {
        label: "🇪🇺 EUROPE",
        items: [
          { code: "en-GB", label: "🇬🇧 English (UK)" },
          { code: "es-ES", label: "🇪🇸 Español (Spain)" },
          { code: "pt", label: "🇵🇹 Português (Portugal)" },
          { code: "fr", label: "🇫🇷 Français (France)" },
          { code: "de", label: "🇩🇪 Deutsch (Germany)" },
          { code: "el", label: "🇬🇷 Ελληνικά (Greece)" },
          { code: "it", label: "🇮🇹 Italiano (Italia)" },
          { code: "ru", label: "🇷🇺 Русский (Russia)" },
          { code: "pl", label: "🇵🇱 Polski (Polska)" },
          { code: "tr", label: "🇹🇷 Türkçe (Turkey)" },
          { code: "fi", label: "🇫🇮 Suomi (Finland)" },
          { code: "sv", label: "🇸🇪 Svenska (Sweden)" },
        ],
      },
      {
        label: "🇺🇸 NORTH AMERICA",
        items: [{ code: "en-US", label: "🇺🇸 English (US)" }],
      },
      {
        label: "🌎 SOUTH AMERICA",
        items: [
          { code: "pt-BR", label: "🇧🇷 Português (Brasil)" },
          { code: "es-AR", label: "🇦🇷 Español (Argentina)" },
          { code: "es-CO", label: "🇨🇴 Español (Colombia)" },
          { code: "es-MX", label: "🇲🇽 Español (México)" },
        ],
      },
      {
        label: "🌏 SOUTH ASIA",
        items: [
          { code: "hi", label: "🇮🇳 हिन्दी (India)" },
          { code: "ur", label: "🇵🇰 اردو (Pakistan)" },
        ],
      },
      {
        label: "🌍 MIDDLE EAST",
        items: [
          { code: "ar", label: "🇸🇦 العربية (Saudi Arabia)" },
          { code: "he", label: "🇮🇱 עברית (Israel)" },
        ],
      },
      {
        label: "🌏 ASIA / OTHER",
        items: [
          { code: "zh", label: "🇨🇳 中文 (China)" },
          { code: "ja", label: "🇯🇵 日本語 (Japan)" },
        ],
      },
      {
        label: "🌍 AFRICA",
        items: [{ code: "sw", label: "🇰🇪 Kiswahili (Swahili)" }],
      },
    ],
    []
  );

  /**
   * Render dropdown:
   * - <select> element with grouped <optgroup>/<option>
   * - aria-label for accessibility, localized with t()
   */
  return (
    <select
      value={value}
      onChange={(e) => changeLanguage(e.target.value)}
      className="bg-white text-blue-800 px-2 py-1 rounded text-sm shadow-sm"
      aria-label={t("select_language_label") || "Select language"}
    >
      <option disabled>{t("select_language_label") || "🌐 Languages"}</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default LanguageSwitcher;
// --- REPLACE END ---

