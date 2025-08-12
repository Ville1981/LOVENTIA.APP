import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

// --- REPLACE START: guard against non-browser environments for localStorage/document ---
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const storedLang = isBrowser
  ? localStorage.getItem("language") || "fi"
  : "fi";
const language = storedLang.split("-")[0];
// --- REPLACE END ---

i18n
  .use(HttpBackend) // load translations via HTTP
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // hook into React
  .init({
    lng: language,
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
    supportedLngs: [
      "fi", "en", "en-US", "en-GB", "pl", "pt", "pt-BR",
      "es", "es-MX", "es-AR", "es-CO", "es-ES", "fr",
      "it", "de", "ru", "tr", "sv", "hi", "ur", "ar",
      "zh", "ja", "he", "el", "sw",
    ],
    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    debug: false,
  });

// --- REPLACE START: only set document direction in browser ---
if (isBrowser) {
  const rtlLanguages = ["ar", "he", "fa", "ur"];
  document.documentElement.setAttribute(
    "dir",
    rtlLanguages.includes(language) ? "rtl" : "ltr"
  );
}
// --- REPLACE END ---

export default i18n;
