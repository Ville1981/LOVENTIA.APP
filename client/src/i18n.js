import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const storedLang = localStorage.getItem("language") || "fi";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: storedLang,
    fallbackLng: {
      "en-US": ["en"],
      "en-GB": ["en"],
      "pt-BR": ["pt"],
      "es-MX": ["es"],
      "es-AR": ["es"],
      "es-CO": ["es"],
      "es-ES": ["es"],
      default: ["en"]  // ✅ fallback aina englanti jos ei omaa
    },
    supportedLngs: [
      "fi", "en", "en-US", "en-GB", "pl",
      "pt", "pt-BR",
      "es", "es-MX", "es-AR", "es-CO", "es-ES",
      "fr", "it", "de", "ru", "tr", "sv",
      "hi", "ur", "ar", "zh", "ja",
      "he", "el", "sw" // ✅ Mukana Swahili ja RTL-kielet
    ],
    backend: {
      loadPath: "/locales/{{lng}}/translation.json"
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"]
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    },
    debug: false
  });

// 🧭 RTL-suunnan asetus kielestä riippuen
const rtlLanguages = ["ar", "he", "fa", "ur"];
const html = document.documentElement;
html.setAttribute("dir", rtlLanguages.includes(storedLang) ? "rtl" : "ltr");

export default i18n;
















