// --- REPLACE START: Canonical Vitest setup with global timeout-cork (≤999ms in tests) ---
/**
 * Global test setup for the client (Vitest).
 * - Adds a SAFE, idempotent timeout "cork" active only in Vitest to cap setTimeout to ≤ 999 ms.
 * - RTL matchers (@testing-library/jest-dom/vitest)
 * - Defensive Vitest globals
 * - Router mocks (react-router-dom v5/v6) + 'history' stubs
 * - Lightweight i18n stubs (react-i18next + backend + detector)
 * - JS DOM polyfills (matchMedia, IntersectionObserver, ResizeObserver, scrollTo, URL blobs)
 * - Storage shims (localStorage/sessionStorage)
 * - RTL cleanup + mock reset between tests
 * - Quieter console.error (keeps meaningful failures)
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import {
  vi,
  expect as _expect,
  describe as _describe,
  it as _it,
  beforeAll as _beforeAll,
  afterAll as _afterAll,
  beforeEach as _beforeEach,
  afterEach as _afterEach,
} from "vitest";

/* -----------------------------------------------------------------------------
 * Timeout cork (Vitest only): cap setTimeout delays to ≤ 999 ms
 *  - Idempotent, patches globalThis.setTimeout (and window.setTimeout if same ref)
 *  - Does NOT affect production/dev builds (only when Vitest is present)
 * ---------------------------------------------------------------------------*/
(() => {
  const g = typeof globalThis !== "undefined" ? globalThis : undefined;
  const isVitest =
    typeof vi !== "undefined" ||
    (typeof import.meta !== "undefined" && !!import.meta?.vitest);

  if (!g || !isVitest || g.__TIMEOUT_CORK_PATCHED__) return;

  const originalSetTimeout =
    (typeof g.setTimeout === "function" && g.setTimeout.bind(g)) || null;
  if (!originalSetTimeout) return;

  const patched = (handler, delay, ...rest) => {
    const n = Number(delay);
    const d = Number.isFinite(n) ? Math.min(n, 999) : 0;
    return originalSetTimeout(handler, d, ...rest);
  };

  g.setTimeout = patched;
  if (typeof window !== "undefined") {
    // Patch window reference regardless of previous identity (more robust with test env swaps)
    // jsdom exposes window.setTimeout separately; always align it with the patched one.
    // eslint-disable-next-line no-undef
    window.setTimeout = patched;
  }

  Object.defineProperty(g, "__TIMEOUT_CORK_PATCHED__", {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
})();

/* -----------------------------------------------------------------------------
 * Ensure Vitest globals exist (defensive)
 * ---------------------------------------------------------------------------*/
if (typeof globalThis.expect === "undefined") globalThis.expect = _expect;
if (typeof globalThis.describe === "undefined") globalThis.describe = _describe;
if (typeof globalThis.it === "undefined") globalThis.it = _it;
if (typeof globalThis.beforeAll === "undefined") globalThis.beforeAll = _beforeAll;
if (typeof globalThis.afterAll === "undefined") globalThis.afterAll = _afterAll;
if (typeof globalThis.beforeEach === "undefined") globalThis.beforeEach = _beforeEach;
if (typeof globalThis.afterEach === "undefined") globalThis.afterEach = _afterEach;

/* -----------------------------------------------------------------------------
 * Router: mock navigation (keep components; override imperative APIs only)
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
 * i18n mocks: react-i18next + backend + detector (synchronous & lightweight)
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

  const initReactI18next = { type: "3rdParty", init: () => {} };

  return {
    useTranslation: () => ({ t, i18n: i18nStub, ready: true }),
    Trans: ({ i18nKey, values, children }) => (children ?? t(i18nKey, values)),
    I18nextProvider: ({ children }) => children,
    initReactI18next,
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
// Always override jsdom's throwing scrollTo with a harmless spy
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-undef
  window.scrollTo = vi.fn();
}

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
    takeRecords() { return []; }
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
    get length() { return store.size; },
  };
}
if (typeof window !== "undefined") {
  if (!window.localStorage) Object.defineProperty(window, "localStorage", { value: makeStorage() });
  if (!window.sessionStorage) Object.defineProperty(window, "sessionStorage", { value: makeStorage() });
}

/* -----------------------------------------------------------------------------
 * RTL cleanup + mock reset between tests
 * ---------------------------------------------------------------------------*/
_afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* -----------------------------------------------------------------------------
 * Silence noisy console errors (keep meaningful ones)
 * ---------------------------------------------------------------------------*/
const __originalConsoleError = console.error;
console.error = (...args) => {
  const msg = String(args[0] ?? "");
  if (
    (msg.includes("Warning: An update to") && msg.includes("inside a test was not wrapped in act")) ||
    msg.includes("i18next::backend")
  ) {
    return;
  }
  __originalConsoleError(...args);
};

// Expose vi for ad-hoc debugging in tests if needed
globalThis.__vi = vi;
// --- REPLACE END ---
