// --- REPLACE START: normalize regional codes to base + robust detection ---
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

/**
 * Guard for non-browser environments (tests/SSR) and helpers.
 */
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

const toBase = (code = "") => String(code).split("-")[0];

/**
 * Read initial language from our own key ("language").
 * Normalize to base (e.g. "es-ES" -> "es") so that it matches our folder names.
 * Default -> "fi" to match your app’s default.
 */
const storedLang = isBrowser ? localStorage.getItem("language") || "fi" : "fi";
const language = toBase(storedLang);

i18n
  .use(HttpBackend) // load translations via HTTP
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // hook into React
  .init({
    // Start with normalized base language
    lng: language,

    // Accept language-only when a regional variant is requested
    nonExplicitSupportedLngs: true,
    load: "languageOnly",

    // Robust fallback mapping
    fallbackLng: {
      "en-US": ["en"],
      "en-GB": ["en"],
      "pt-BR": ["pt"],
      "es-MX": ["es"],
      "es-AR": ["es"],
      "es-CO": ["es"],
      "es-ES": ["es"],
      default: ["en"],
    },

    // Keep your current set; base codes are what matters on disk
    supportedLngs: [
      "fi", "en", "en-US", "en-GB", "pl", "pt", "pt-BR",
      "es", "es-MX", "es-AR", "es-CO", "es-ES", "fr",
      "it", "de", "ru", "tr", "sv", "hi", "ur", "ar",
      "zh", "ja", "he", "el", "sw",
    ],

    backend: {
      // We host translations under /public/locales/{{lng}}/translation.json
      loadPath: "/locales/{{lng}}/translation.json",
    },

    detection: {
      // Look in our custom key first, then browser defaults
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "language", // <— use our key
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },

    debug: false,
  });

/**
 * Update document direction for RTL languages.
 */
if (isBrowser) {
  const rtlLanguages = ["ar", "he", "fa", "ur"];

  const setDir = (lng) => {
    const base = toBase(lng);
    document.documentElement.setAttribute(
      "dir",
      rtlLanguages.includes(base) ? "rtl" : "ltr"
    );
  };

  // Set on init
  setDir(language);

  // Update on changes
  i18n.on("languageChanged", setDir);
}

export default i18n;
// --- REPLACE END ---
