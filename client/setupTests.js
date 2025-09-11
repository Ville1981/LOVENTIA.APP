// File: client/setupTests.js

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Patch for React Router (history.push issue)
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// --- REPLACE START: add JSDOM shims for storage, media queries, and scroll + global cleanup ---

/**
 * Create a minimal in-memory Storage polyfill compatible with Web Storage API.
 */
function createMemoryStorage() {
  /** @type {Record<string, string>} */
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[String(key)] = String(value);
    },
    removeItem(key) {
      delete store[String(key)];
    },
    clear() {
      store = {};
    },
    key(i) {
      const keys = Object.keys(store);
      return keys[i] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
}

/**
 * Apply browser-like shims to the JSDOM environment so tests that expect
 * these APIs (localStorage, matchMedia, scrollTo) do not crash.
 */
(function applyJSDOMShims() {
  if (typeof window === "undefined") return;

  // localStorage / sessionStorage
  if (typeof window.localStorage === "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
      enumerable: true,
      writable: false,
    });
  }
  if (typeof window.sessionStorage === "undefined") {
    Object.defineProperty(window, "sessionStorage", {
      value: createMemoryStorage(),
      configurable: true,
      enumerable: true,
      writable: false,
    });
  }

  // matchMedia (needed by enquire.js / react-slick and others)
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = function matchMedia(query) {
      return {
        matches: false,
        media: String(query),
        onchange: null,
        addListener: () => {},          // deprecated, kept for compatibility
        removeListener: () => {},       // deprecated, kept for compatibility
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    };
  }

  // scrollTo
  if (typeof window.scrollTo !== "function") {
    window.scrollTo = () => {};
  }
})();

/**
 * Ensure RTL cleans up between tests and all mocks are reset.
 * Prevents cross-test leakage (duplicate nodes, stale mocks, etc.).
 */
import { cleanup } from "@testing-library/react";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// --- REPLACE END ---
