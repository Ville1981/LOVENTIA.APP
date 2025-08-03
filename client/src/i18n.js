// src/i18n.js

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
  // load translations via HTTP
  .use(HttpBackend)
  // detect user language
  .use(LanguageDetector)
  // hook into React
  .use(initReactI18next)
  .init({
    // set active language
    lng: language,
    // fallback languages map
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
    // supported languages list
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
    // where to load translation files from
    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },
    // language detector options
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
