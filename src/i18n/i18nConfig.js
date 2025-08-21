// --- REPLACE START: normalize regional codes, robust BASE_URL, and safe RTL handling ---
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

/** Return base language (e.g., 'en' from 'en-GB') */
const toBase = (code = "") => String(code).split("-")[0];

/** Prefer explicitly stored language, else browser */
const storedLang = isBrowser ? localStorage.getItem("language") || "fi" : "fi";
const language = toBase(storedLang);

/** Respect Vite's base (supports subpath deploys) */
const BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.BASE_URL) ||
  "/";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Initial language (can be changed at runtime)
    lng: language,

    // Load only the base language part (en, fi, es…)
    nonExplicitSupportedLngs: true,
    load: "languageOnly",

    // Fallback map with a reasonable default
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

    // Keep this list broad; non-explicit loading will fold regionals into base
    supportedLngs: [
      "fi",
      "en",
      "en-US",
      "en-GB",
      "pl",
      "pt",
      "pt-BR",
      "es",
      "es-MX",
      "es-AR",
      "es-CO",
      "es-ES",
      "fr",
      "it",
      "de",
      "ru",
      "tr",
      "sv",
      "hi",
      "ur",
      "ar",
      "zh",
      "ja",
      "he",
      "el",
      "sw",
    ],

    // Use Vite BASE_URL to resolve static assets anywhere (/, /app/, etc.)
    backend: {
      loadPath: `${BASE_URL}locales/{{lng}}/translation.json`,
    },

    // Let users force a language with localStorage first, then browser
    detection: {
      order: ["localStorage", "querystring", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "language",
      lookupQuerystring: "lng",
    },

    // Never escape React (it escapes by default)
    interpolation: { escapeValue: false },

    // Avoid suspense unless explicitly wanted
    react: { useSuspense: false },

    // These help avoid showing the raw keys if something is missing
    keySeparator: false,
    returnObjects: true,

    debug: false,
  });

// Handle document direction for RTL languages
if (isBrowser) {
  const rtlLanguages = ["ar", "he", "fa", "ur"];
  const setDir = (lng) => {
    const base = toBase(lng);
    const dir = rtlLanguages.includes(base) ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
  };
  setDir(language);
  i18n.on("languageChanged", setDir);
}

export default i18n;
// --- REPLACE END ---
