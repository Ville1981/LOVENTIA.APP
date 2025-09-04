// PATH: i18n.js

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
 *   "common", "profile", "lifestyle", "discover", "chat", "navbar", "footer", "translation"
 * - Changing language will:
 *     1) persist to localStorage
 *     2) update <html lang=".."> and dir attribute
 *     3) trigger re-render of components using useTranslation()
 *
 * This file only affects UI copy. It does NOT influence Stripe Portal language.
 * Keep texts like "Open Billing Portal" in English in your UI components if desired.
 */

export const SUPPORTED_LANGS = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk","hu","et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur"
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
];

const FALLBACK_LANG = "en";
const STORAGE_KEY = "i18nextLng";

// Ensure language code is supported; fall back if needed
function normalizeLang(lng) {
  if (!lng || typeof lng !== "string") return FALLBACK_LANG;
  const base = lng.split("-")[0].toLowerCase();
  if (SUPPORTED_LANGS.includes(lng)) return lng;
  if (SUPPORTED_LANGS.includes(base)) return base;
  return FALLBACK_LANG;
}

// RTL helper
function isRtl(lng) {
  const norm = normalizeLang(lng);
  return ["ar", "he", "ur", "fa"].includes(norm);
}

// Set <html lang> and dir (RTL for ar/he/ur/fa)
function applyHtmlLang(lng) {
  const html = document.documentElement;
  const norm = normalizeLang(lng);
  html.setAttribute("lang", norm);
  html.setAttribute("dir", isRtl(norm) ? "rtl" : "ltr");
}

// Persisted language or fallback — guarded for environments where localStorage may throw
let persistedRaw = null;
try {
  persistedRaw = window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
} catch {
  // ignore storage errors (e.g., privacy mode)
}
const persisted = normalizeLang(persistedRaw) || FALLBACK_LANG;

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      // Vite serves /public at the web root -> /locales/...
      loadPath: "/locales/{{lng}}/{{ns}}.json",
      crossDomain: true
    },

    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag", "cookie"],
      caches: ["localStorage"],
      lookupQuerystring: "lng",
      lookupLocalStorage: STORAGE_KEY,
      lookupCookie: "i18next"
    },

    supportedLngs: SUPPORTED_LANGS,
    fallbackLng: FALLBACK_LANG,
    lng: persisted, // start from persisted or fallback
    ns: NAMESPACES,
    defaultNS: "common",
    fallbackNS: ["common", "translation"],
    load: "currentOnly",

    // Use "ns:key" in code and dotted paths in JSON
    nsSeparator: ":",   // e.g. "profile:age"
    keySeparator: ".",  // keep dotted keys for nested JSON

    interpolation: { escapeValue: false },

    debug: Boolean(import.meta?.env?.DEV),

    // Prefer showing the key over null/empty when missing
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,

    saveMissing: false,
    nonExplicitSupportedLngs: true,
    cleanCode: true,

    react: {
      useSuspense: false,
      bindI18n: "languageChanged loaded"
    }
  })
  .then(() => {
    // Normalize the effective language and apply to <html>
    const effective = normalizeLang(i18n.language);
    if (!i18n.language || i18n.language !== effective) {
      // If detector returned "en-US" and we only have "en"
      i18n.changeLanguage(effective);
    }
    applyHtmlLang(effective);

    // Keep <html lang> & localStorage in sync on language changes
    i18n.on("languageChanged", (lng) => {
      try {
        const norm = normalizeLang(lng);
        localStorage.setItem(STORAGE_KEY, norm);
        applyHtmlLang(norm);
      } catch {
        // ignore storage errors
      }
    });

    // --- REPLACE START: expose i18n for console debugging (after init to avoid undefined lng) ---
    if (typeof window !== "undefined" && window && !window.i18next) {
      window.i18next = i18n;
      window.t = i18n.t.bind(i18n);
      // eslint-disable-next-line no-console
      console.info("[i18n] window.i18next exposed:", {
        lng: i18n.language,
        ns: i18n.options?.ns,
        nsSeparator: i18n.options?.nsSeparator
      });
    }
    // Optional: extra init log
    i18n.on("initialized", (opts) => {
      // eslint-disable-next-line no-console
      console.log("[i18n] initialized", opts, "current lang:", i18n.language);
    });
    // --- REPLACE END ---
  })
  .catch((err) => {
    if (import.meta?.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error("i18n init error:", err);
    }
  });

/** Public helper: change app language programmatically. */
export async function setAppLanguage(lng) {
  const norm = normalizeLang(lng);
  await i18n.changeLanguage(norm);
  return norm;
}

/** Public helper: preload a namespace on demand (useful before pushing a route). */
export function preloadNamespace(ns, lng = i18n.language) {
  const normNs = Array.isArray(ns) ? ns : [ns];
  const normLng = normalizeLang(lng);
  return Promise.all([
    i18n.loadNamespaces(normNs),
    i18n.loadLanguages(normLng)
  ]);
}

/** Public helper: query if the current language is RTL. */
export function isCurrentLanguageRtl() {
  return isRtl(i18n.language);
}

export default i18n;
// --- REPLACE END ---
