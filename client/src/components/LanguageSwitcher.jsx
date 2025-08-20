// client/src/components/LanguageSwitcher.jsx

// --- REPLACE START: persist + normalize + robust options ---
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Small helper to normalize e.g. "es-ES" -> "es"
 * Keeps our folder structure consistent with i18n init (load:"languageOnly").
 */
const toBase = (code = "") => String(code).split("-")[0]?.toLowerCase();

/**
 * STORAGE KEY
 * Align with i18n config so both read/write the same key.
 * (i18n.js uses localStorage key "i18nextLng")
 */
const STORAGE_KEY = "i18nextLng";

/**
 * LanguageSwitcher component
 *
 * Provides a <select> dropdown with grouped language options.
 * - Persists choice in localStorage (key aligned with i18n)
 * - Normalizes codes so "en-GB" resolves to "en"
 * - Updates <html dir="ltr|rtl"> on language change
 * - Keeps dropdown in sync with i18n.language
 */
const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  /**
   * Initial value:
   * Prefer i18n.language → fallback to persisted base → finally "fi".
   * Using BASE so dropdown always matches loaded translation folder.
   */
  const persisted = toBase(
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : ""
  );
  const initial = toBase(i18n.language) || persisted || "fi";
  const [value, setValue] = useState(initial);

  /**
   * Effect: update <html dir="…"> & keep local state synced when language changes
   * Important for RTL languages (ar, he, ur, fa).
   */
  useEffect(() => {
    const rtl = ["ar", "he", "fa", "ur"];
    const updateDirAndState = (lng) => {
      const base = toBase(lng);
      // Update document direction
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "dir",
          rtl.includes(base) ? "rtl" : "ltr"
        );
      }
      // Keep dropdown in sync with the *current* i18n language
      setValue(base);
    };

    // Run once at mount for the current language
    updateDirAndState(i18n.language);

    // Subscribe to runtime language changes
    i18n.on("languageChanged", updateDirAndState);
    return () => i18n.off("languageChanged", updateDirAndState);
  }, [i18n]);

  /**
   * changeLanguage:
   * - Normalize and persist base code in localStorage (STORAGE_KEY aligned with i18n)
   * - Switch i18n using the BASE language to match /locales/<lng>/<ns>.json
   * - Update local state (keeps the selected option visible)
   */
  const changeLanguage = (lng) => {
    const base = toBase(lng);
    try {
      // Switch i18n first (ensures components re-render with new translations)
      if (i18n.language !== base) {
        i18n.changeLanguage(base);
      }
      // Persist after successful change
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, base);
      }
    } catch {
      // ignore persistence errors (e.g., private mode)
    }
    // Show the exact option the user chose in the dropdown
    setValue(lng);
  };

  /**
   * groups:
   * Language dropdown options grouped by region.
   * Each group has label + array of {code,label}.
   * (Codes may include region tags; we normalize to the base on change)
   */
  const groups = useMemo(
    () => [
      {
        label: "🇪🇺 EUROPE",
        items: [
          { code: "en-GB", label: "🇬🇧 English (UK)" },
          { code: "es-ES", label: "🇪🇸 Español (España)" },
          { code: "pt", label: "🇵🇹 Português (Portugal)" },
          { code: "fr", label: "🇫🇷 Français (France)" },
          { code: "de", label: "🇩🇪 Deutsch (Deutschland)" },
          { code: "el", label: "🇬🇷 Ελληνικά (Ελλάδα)" },
          { code: "it", label: "🇮🇹 Italiano (Italia)" },
          { code: "ru", label: "🇷🇺 Русский (Россия)" },
          { code: "pl", label: "🇵🇱 Polski (Polska)" },
          { code: "tr", label: "🇹🇷 Türkçe (Türkiye)" },
          { code: "fi", label: "🇫🇮 Suomi (Suomi)" },
          { code: "sv", label: "🇸🇪 Svenska (Sverige)" },
          { code: "nl", label: "🇳🇱 Nederlands (Nederland)" },
          { code: "no", label: "🇳🇴 Norsk (Norge)" },
          { code: "da", label: "🇩🇰 Dansk (Danmark)" },
          { code: "cs", label: "🇨🇿 Čeština (Česko)" },
          { code: "sk", label: "🇸🇰 Slovenčina (Slovensko)" },
          { code: "hu", label: "🇭🇺 Magyar (Magyarország)" },
          { code: "et", label: "🇪🇪 Eesti (Eesti)" },
          { code: "lt", label: "🇱🇹 Lietuvių (Lietuva)" },
          { code: "lv", label: "🇱🇻 Latviešu (Latvija)" },
          { code: "bg", label: "🇧🇬 Български (България)" },
          { code: "ro", label: "🇷🇴 Română (România)" },
          { code: "uk", label: "🇺🇦 Українська (Україна)" },
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
          { code: "hi", label: "🇮🇳 हिन्दी (भारत)" },
          { code: "ur", label: "🇵🇰 اردو (پاکستان)" },
        ],
      },
      {
        label: "🌍 MIDDLE EAST",
        items: [
          { code: "ar", label: "🇸🇦 العربية (السعودية)" },
          { code: "he", label: "🇮🇱 עברית (ישראל)" },
        ],
      },
      {
        label: "🌏 EAST ASIA",
        items: [
          { code: "zh", label: "🇨🇳 中文 (中国)" },
          { code: "ja", label: "🇯🇵 日本語 (日本)" },
          { code: "ko", label: "🇰🇷 한국어 (대한민국)" },
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
      aria-label={t("select_language_label", { defaultValue: "Select language" })}
    >
      <option disabled>
        {t("select_language_label", { defaultValue: "🌐 Languages" })}
      </option>
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












