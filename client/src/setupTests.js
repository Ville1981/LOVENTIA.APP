// File: client/src/setupTests.js

// --- REPLACE START: setup for Vitest + RTL + router (v5+v6) + i18n stubs & polyfills ---
/**
 * Global test setup for the client (Vitest).
 * - React Testing Library matchers
 * - Safe mocks for react-router-dom navigation (supports legacy useHistory().push and v6 useNavigate)
 * - Stub for 'history' package so any custom history.push() works in tests
 * - i18n stubs: mock react-i18next hooks/components + backend & detector (no network, no heavy init)
 * - JS DOM polyfills (matchMedia, IntersectionObserver, ResizeObserver, scrollTo, URL blobs)
 * - Storage shims (localStorage/sessionStorage)
 * - Quiet common noisy console errors in test output
 *
 * Important:
 *  - No environment forcing (e.g., "web") here.
 *  - Avoid heavyweight dynamic imports in setup (prevents resolve/fetch timeouts).
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

/* -----------------------------------------------------------------------------
 * Router: mock navigation
 * Keep the actual components, only override imperative navigation APIs.
 * ---------------------------------------------------------------------------*/
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  const navigateFn = vi.fn();
  const historyObj = {
    length: 1,
    action: "POP",
    location: { pathname: "/", search: "", hash: "", state: null, key: "test" },
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    listen: vi.fn(() => vi.fn()),
    createHref: vi.fn((loc) => (typeof loc === "string" ? loc : loc?.pathname || "/")),
    block: vi.fn(() => vi.fn()),
  };

  return {
    ...actual,
    useNavigate: () => navigateFn, // v6 programmatic navigation
    useHistory: () => historyObj,  // legacy v5-style navigation
  };
});

/* -----------------------------------------------------------------------------
 * 'history' package stub
 * ---------------------------------------------------------------------------*/
vi.mock("history", async () => {
  const mk = () => ({
    length: 1,
    action: "POP",
    location: { pathname: "/", search: "", hash: "", state: null, key: "test" },
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    listen: vi.fn(() => vi.fn()),
    createHref: vi.fn((loc) => (typeof loc === "string" ? loc : loc?.pathname || "/")),
    block: vi.fn(() => vi.fn()),
  });
  return {
    createBrowserHistory: mk,
    createHashHistory: mk,
    createMemoryHistory: mk,
    History: Object,
  };
});

/* -----------------------------------------------------------------------------
 * i18n mocks: react-i18next + backend + detector (SYNCHRONOUS, LIGHTWEIGHT)
 * IMPORTANT: No vi.importActual here to avoid resolveId/fetch timeouts.
 * ---------------------------------------------------------------------------*/
vi.mock("react-i18next", () => {
  // Minimal translation map for commonly used test keys; otherwise echo the key.
  const T_MAP = {
    "chat:overview.loading": "Loading conversations",
    "chat:overview.error": "Unable to load conversations",
    "chat:overview.title": "Conversations",
    "chat:overview.empty": "No conversations",
    "common:noData": "No conversations",
    "common:all": "All",
    "common:select": "Select",
  };

  const t = (key, opts) => {
    if (typeof key !== "string") return "";
    const base = T_MAP[key] ?? key;
    if (opts && typeof opts === "object") {
      return Object.keys(opts).reduce(
        (acc, k) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(opts[k])),
        base
      );
    }
    return base;
  };

  const i18nStub = {
    language: "en",
    changeLanguage: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockReturnValue(true),
    dir: vi.fn(() => "ltr"),
    getResource: vi.fn(),
    addResourceBundle: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  // Provide minimal named exports used by the app/tests.
  // Note: include initReactI18next to satisfy potential imports (no-op).
  const initReactI18next = { type: "3rdParty", init: () => {} };

  return {
    // Hooks/components
    useTranslation: () => ({ t, i18n: i18nStub, ready: true }),
    Trans: ({ i18nKey, values, children }) => (children ?? t(i18nKey, values)),
    I18nextProvider: ({ children }) => children,
    initReactI18next,
    // Keep default export shape loosely compatible if referenced
    default: { useTranslation: () => ({ t, i18n: i18nStub, ready: true }) },
  };
});

// Mock i18next backend to avoid network
vi.mock("i18next-http-backend", () => {
  class HttpBackendStub {
    static type = "backend";
    init() {}
    read(_lng, _ns, cb) {
      cb(null, {}); // empty resources
    }
  }
  return { default: HttpBackendStub };
});

// Mock language detector to avoid browser-dependent behavior
vi.mock("i18next-browser-languagedetector", () => {
  class DetectorStub {
    static type = "languageDetector";
    init() {}
    detect() {
      return "en";
    }
    cacheUserLanguage() {}
  }
  return { default: DetectorStub };
});

/* -----------------------------------------------------------------------------
 * JS DOM polyfills
 * ---------------------------------------------------------------------------*/
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-ignore
  globalThis.IntersectionObserver = IntersectionObserverMock;
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-ignore
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof window !== "undefined" && !window.scrollTo) {
  window.scrollTo = vi.fn();
}

if (!("URL" in globalThis)) {
  // @ts-ignore
  globalThis.URL = {};
}
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = vi.fn();
}

/* -----------------------------------------------------------------------------
 * Storage shims
 * ---------------------------------------------------------------------------*/
function makeStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    removeItem: vi.fn((k) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((i) => Array.from(store.keys())[i] ?? null),
    get length() {
      return store.size;
    },
  };
}
if (typeof window !== "undefined") {
  if (!window.localStorage) Object.defineProperty(window, "localStorage", { value: makeStorage() });
  if (!window.sessionStorage) Object.defineProperty(window, "sessionStorage", { value: makeStorage() });
}

/* -----------------------------------------------------------------------------
 * Silence noisy console errors (keeps meaningful ones)
 * ---------------------------------------------------------------------------*/
const originalError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? "");
  if (
    (msg.includes("Warning: An update to") && msg.includes("inside a test was not wrapped in act")) ||
    msg.includes("i18next::backend")
  ) {
    return;
  }
  originalError(...args);
};

// Expose vi for tests that may need it
// eslint-disable-next-line no-underscore-dangle
globalThis.__vi = vi;
// --- REPLACE END ---
