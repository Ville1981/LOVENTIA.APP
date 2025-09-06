// File: tests/setup/vitest.setup.js

// --- REPLACE START -----------------------------------------------------------
// Ensure DOM matchers are available (fixes: "Invalid Chai property: toBeInTheDocument")
import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

// --- JEST SHIM (allow old Jest-style APIs to work under Vitest) --------------
global.jest = {
  fn: vi.fn,
  spyOn: vi.spyOn,
  mock: vi.mock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  // Timer APIs used by legacy tests
  useFakeTimers: vi.useFakeTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
  runAllTimers: vi.runAllTimers,
  clearAllTimers: vi.clearAllTimers,
};

// --- JSDOM defaults ----------------------------------------------------------
if (!global.window) global.window = window;
if (!window.location) window.location = new URL("http://localhost/");

// matchMedia polyfill (react-slick/enquire.js requires this)
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // legacy
      removeListener: () => {}, // legacy
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// localStorage polyfill
if (!("localStorage" in global)) {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Minimal sessionStorage polyfill (some components use it)
if (!("sessionStorage" in global)) {
  const store = new Map();
  global.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// Vite envs used in code under test
// (keeps existing values if provided)
globalThis.import.meta = globalThis.import.meta || {};
globalThis.import.meta.env = globalThis.import.meta.env || {};
globalThis.import.meta.env.VITE_SOCKET_URL =
  globalThis.import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

// Silence noisy console in tests (optional; keeps output available if needed)
vi.stubGlobal("console", {
  ...console,
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
});

// --- React-i18next lightweight mock ------------------------------------------
// Prevents "react-i18next:: useTranslation: You will need to pass in an i18next instance"
// and components calling i18n.on/off/changeLanguage will not crash.
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // return a stable translator: t(key, default) -> default || key
    useTranslation: () => ({
      t: (key, defaultText) => (defaultText ?? key),
      i18n: {
        language: "en",
        // event API used by some components (e.g., LanguageSwitcher)
        on: () => {},
        off: () => {},
        changeLanguage: vi.fn().mockResolvedValue(),
      },
    }),
    // Provider passthrough to avoid needing a real i18next instance
    I18nextProvider: ({ children }) => children,
    Trans: ({ children }) => children,
  };
});
// --- REPLACE END -------------------------------------------------------------

