// File: client/src/i18n.js
// --- REPLACE START: add "countries" namespace + preload, fix import order, keep behavior intact ---
/* eslint-env browser */
/* eslint-disable import/no-named-as-default-member, import/no-named-as-default */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

/**
 * IMPORTANT NOTES
 * - Expects translation files in: /public/locales/{lng}/{ns}.json
 * - Namespaces are split by feature:
 *   "common", "profile", "lifestyle", "discover", "chat", "navbar", "footer", "translation", "premium", "countries"
 * - Changing language will:
 *     1) persist to localStorage
 *     2) update <html lang=".."> and dir attribute
 *     3) trigger re-render of components using useTranslation()
 *
 * This file only affects UI copy. It does NOT influence Stripe Portal language.
 */

export const SUPPORTED_LANGS = [
  "en","fi","sv","de","fr","es","it","pt","pl","ro","tr","nl","no","da","cs","sk","hu",
  "et","lt","lv","bg","el","uk","ru","ja","ko","zh","ar","he","hi","sw","ur"
];

export const NAMESPACES = [
  "common",
  "profile",
  "lifestyle",
  "discover",
  "chat",
  "navbar",
  "footer",
  "translation",
  // --- REPLACE START: add premium namespace for billing/subscription UI ---
  "premium",
  // --- REPLACE END ---
  // ↓ ADDED: ensure country names are available to the UI out of the box
  "countries"
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
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const norm = normalizeLang(lng);
  html.setAttribute("lang", norm);
  html.setAttribute("dir", isRtl(norm) ? "rtl" : "ltr");
}

// Persisted language or fallback — guarded for environments where localStorage may throw
let persistedRaw = null;
try {
  persistedRaw = typeof window !== "undefined" && window.localStorage
    ? localStorage.getItem(STORAGE_KEY)
    : null;
} catch {
  // ignore storage errors
}
const persisted = normalizeLang(persistedRaw) || FALLBACK_LANG;

/* -----------------------------------------------------------------------------
 * TEST-ONLY LIGHTWEIGHT INIT
 * Avoid HttpBackend and LanguageDetector in Vitest/Jest to prevent network calls
 * and cross-bundle React collisions. Provide minimal default resources.
 * ---------------------------------------------------------------------------*/
if (process.env.NODE_ENV === "test") {
  i18n
    .use(initReactI18next)
    .init({
      lng: "en",
      fallbackLng: FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGS,
      ns: NAMESPACES,
      defaultNS: "common",
      // --- REPLACE START: include premium in fallbackNS for test env ---
      fallbackNS: ["common", "translation", "premium"],
      // --- REPLACE END ---
      // keeping resources minimal in tests
      resources: {
        en: {
          common: {
            heroImageAlt: "Hero",
            noData: "No conversations",
          },
          chat: {
            overview: {
              loading: "Loading conversations",
              error: "Unable to load conversations",
              title: "Conversations",
              empty: "No conversations",
            },
          },
          // Optional: minimal premium keys for tests (safe to keep tiny)
          premium: {
            goToSubscriptions: "Go to subscription settings",
          },
          // tests do not need full countries list
        },
      },
      // i18next options
      nsSeparator: ":",
      keySeparator: ".",
      interpolation: { escapeValue: false },
      returnNull: false,
      returnEmptyString: false,
      // --- REPLACE START: allow defaultValue to win over missing-key handler ---
      // In some i18next versions parseMissingKeyHandler is called when key is missing.
      // If it always returns the key, it can override defaultValue and show raw keys in UI.
      // Prefer defaultValue when available.
      parseMissingKeyHandler: (key, defaultValue) => defaultValue || key,
      // --- REPLACE END ---
      react: { useSuspense: false, bindI18n: "languageChanged loaded" },
      // preload is harmless here; resources are inline anyway
      preload: ["en"], // ensures parity with app init
    })
    .then(() => {
      // Ensure i18n.dir() exists in tests (some libs call it)
      if (typeof i18n.dir !== "function") {
        // @ts-ignore
        i18n.dir = () => (isRtl(i18n.language) ? "rtl" : "ltr");
      }
      applyHtmlLang(i18n.language);
    })
    .catch(() => { /* quiet in tests */ });

} else {
  /* -----------------------------------------------------------------------------
   * NORMAL APP INIT (DEV/PROD)
   * ---------------------------------------------------------------------------*/
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      backend: {
        // Vite serves /public at the web root -> /locales/...
        loadPath: "/locales/{{lng}}/{{ns}}.json",
        crossDomain: true,
      },

      detection: {
        order: ["querystring", "localStorage", "navigator", "htmlTag", "cookie"],
        caches: ["localStorage"],
        lookupQuerystring: "lng",
        lookupLocalStorage: STORAGE_KEY,
        lookupCookie: "i18next",
      },

      supportedLngs: SUPPORTED_LANGS,
      fallbackLng: FALLBACK_LANG,
      lng: persisted,

      // ↓ This now includes "countries" and "premium"
      ns: NAMESPACES,
      defaultNS: "common",
      // --- REPLACE START: include premium in fallbackNS to reduce raw-key UI ---
      fallbackNS: ["common", "translation", "premium"],
      // --- REPLACE END ---

      // ↓ Preload English so /locales/en/countries.json (and other ns) is fetched immediately
      preload: ["en"],

      load: "currentOnly",
      nsSeparator: ":",
      keySeparator: ".",
      interpolation: { escapeValue: false },
      debug: Boolean(import.meta?.env?.DEV),
      returnNull: false,
      returnEmptyString: false,
      // --- REPLACE START: allow defaultValue to win over missing-key handler ---
      parseMissingKeyHandler: (key, defaultValue) => defaultValue || key,
      // --- REPLACE END ---
      saveMissing: false,
      nonExplicitSupportedLngs: true,
      cleanCode: true,

      react: {
        useSuspense: false,
        bindI18n: "languageChanged loaded",
      },
    })
    .then(() => {
      const effective = normalizeLang(i18n.language);
      if (!i18n.language || i18n.language !== effective) {
        i18n.changeLanguage(effective);
      }
      applyHtmlLang(effective);

      i18n.on("languageChanged", (lng) => {
        try {
          const norm = normalizeLang(lng);
          localStorage.setItem(STORAGE_KEY, norm);
          applyHtmlLang(norm);
        } catch {
          // ignore storage errors
        }
      });

      // Expose i18n for console debugging (non-test only)
      if (typeof window !== "undefined" && window && !window.i18next) {
        window.i18next = i18n;
        // handy: window.t('ns:key')
        window.t = i18n.t.bind(i18n);
        // eslint-disable-next-line no-console
        console.info("[i18n] window.i18next exposed:", {
          lng: i18n.language,
          ns: i18n.options?.ns,
          nsSeparator: i18n.options?.nsSeparator,
        });
      }

      i18n.on("initialized", (opts) => {
        // eslint-disable-next-line no-console
        console.log("[i18n] initialized", opts, "current lang:", i18n.language);
      });
    })
    .catch((err) => {
      if (import.meta?.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error("i18n init error:", err);
      }
    });
}

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
  return Promise.all([i18n.loadNamespaces(normNs), i18n.loadLanguages(normLng)]);
}

/** Public helper: query if the current language is RTL. */
export function isCurrentLanguageRtl() {
  return isRtl(i18n.language);
}

export default i18n;
// --- REPLACE END ---

