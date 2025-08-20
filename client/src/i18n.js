// --- REPLACE START: robust i18n init with HttpBackend, detector, multi-namespaces, and helpers ---
/* eslint-env browser */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

/**
 * IMPORTANT NOTES
 * - Expects translation files in: /public/locales/{lng}/{ns}.json
 * - Namespaces kept separate to avoid huge single files and to match page/components:
 *   "common", "profile", "lifestyle", "discover", "chat", "navbar", "footer"
 * - Changing language will:
 *     1) persist to localStorage
 *     2) update <html lang=".."> and dir attribute
 *     3) trigger re-render of components using useTranslation()
 */

// Keep this aligned with available folders under /public/locales
export const SUPPORTED_LANGS = [
  "en", "fi", "sv", "de", "fr", "es", "it", "pt", "pl", "ro", "tr", "nl", "no", "da", "cs", "sk", "hu", "et", "lt", "lv", "bg", "el", "uk", "ru", "ja", "ko", "zh", "ar", "he", "hi", "sw", "ur",
];

export const NAMESPACES = [
  "common",
  "profile",
  "lifestyle",
  "discover",
  "chat",
  "navbar",
  "footer",
  "translation"
]

const FALLBACK_LANG = "en";
const STORAGE_KEY = "i18nextLng";

// Utility: ensure language code is supported; fall back if needed
function normalizeLang(lng) {
  if (!lng || typeof lng !== "string") return FALLBACK_LANG;
  // i18next may hand us "en-US" → reduce to base if not present
  const base = lng.split("-")[0].toLowerCase();
  if (SUPPORTED_LANGS.includes(lng)) return lng;
  if (SUPPORTED_LANGS.includes(base)) return base;
  return FALLBACK_LANG;
}

// Utility: set <html lang> and dir (RTL handling if you add Arabic/Hebrew later)
function applyHtmlLang(lng) {
  const html = document.documentElement;
  const norm = normalizeLang(lng);
  html.setAttribute("lang", norm);
  // Extend here if you later support RTL langs: e.g. ['ar','he','fa','ur']
  const isRTL = false;
  html.setAttribute("dir", isRTL ? "rtl" : "ltr");
}

// Persist selected language early if present
const persisted = normalizeLang(localStorage.getItem(STORAGE_KEY));

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // HttpBackend config: load /locales/{{lng}}/{{ns}}.json
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
      // allow cross-origin in dev setups if needed
      crossDomain: true,
    },

    // Language detection & persistence
    detection: {
      // Query then localStorage then browser, finally <html lang>
      order: ["querystring", "localStorage", "navigator", "htmlTag", "cookie"],
      caches: ["localStorage"],
      lookupQuerystring: "lng",
      lookupLocalStorage: STORAGE_KEY,
      // do not set cookie by default
      lookupCookie: "i18next",
    },

    // Core options
    supportedLngs: SUPPORTED_LANGS,
    fallbackLng: FALLBACK_LANG,
    lng: persisted, // start from persisted if available
    ns: NAMESPACES,
    defaultNS: "common",
    fallbackNS: ["common", "translation"],
    load: "currentOnly", // do not auto-load en-US if we only provide en

    // Explicit separators (important for ns:key syntax)
    nsSeparator: ":",       // e.g. "profile:age"
    keySeparator: ".",      // keep dotted keys for nested JSON (default)

    // Interpolation for React (no XSS risk because React escapes)
    interpolation: {
      escapeValue: false,
    },

    // Avoid noisy console in prod
    debug: Boolean(import.meta?.env?.DEV),

    // If keys are missing, show the key itself as a last resort
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,
    saveMissing: false,
    nonExplicitSupportedLngs: true,
    cleanCode: true,
    react: {
      // Make sure components update on language changes
      useSuspense: false,
      bindI18n: "languageChanged loaded",
    },
  })
  .then(() => {
    // Apply to <html> on startup
    applyHtmlLang(i18n.language);

    // Keep <html lang> in sync on runtime lang changes
    i18n.on("languageChanged", (lng) => {
      try {
        const norm = normalizeLang(lng);
        localStorage.setItem(STORAGE_KEY, norm);
        applyHtmlLang(norm);
      } catch {
        // ignore storage errors (Safari Private mode etc.)
      }
    });
  })
  .catch((err) => {
    // Silent init failure should not break the app; log in dev
    // eslint-disable-next-line no-console
    if (import.meta?.env?.DEV) console.error("i18n init error:", err);
  });

/**
 * Public helper: change app language programmatically.
 * Example usage: import { setAppLanguage } from "./i18n"; setAppLanguage("fi");
 */
export async function setAppLanguage(lng) {
  const norm = normalizeLang(lng);
  await i18n.changeLanguage(norm);
  // localStorage + <html lang> are handled by the listener above
  return norm;
}

/**
 * Public helper: preload a namespace on demand (useful before pushing a route)
 */
export function preloadNamespace(ns, lng = i18n.language) {
  const normNs = Array.isArray(ns) ? ns : [ns];
  const normLng = normalizeLang(lng);
  return Promise.all(
    normNs.map(() =>
      i18n.loadNamespaces(normNs).then(() => i18n.loadLanguages(normLng))
    )
  );
}

export default i18n;
// --- REPLACE END ---

// --- REPLACE START: expose i18n for console debugging ---
if (typeof window !== "undefined" && window && !window.i18next) {
  window.i18next = i18n;
  window.t = i18n.t.bind(i18n);
  // eslint-disable-next-line no-console
  console.info("[i18n] window.i18next exposed:", {
    lng: i18n.language,
    ns: i18n.options?.ns,
    nsSeparator: i18n.options?.nsSeparator,
  });
}
// --- REPLACE END ---
