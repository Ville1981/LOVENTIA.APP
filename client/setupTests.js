import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// --- scrollTo shim (JSDOM ei toteuta tätä) ---
if (typeof window !== "undefined" && typeof window.scrollTo !== "function") {
  Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true });
}

// --- matchMedia polyfill (enquire.js yms. tarvitsevat) ---
const mmFactory = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},           // legacy
  removeListener: () => {},        // legacy
  addEventListener: () => {},      // modern
  removeEventListener: () => {},   // modern
  dispatchEvent: () => false,
});

if (typeof globalThis.matchMedia !== "function") {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (q) => mmFactory(q),
  });
}
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (q) => mmFactory(q),
  });
}

// --- mockkaa enquire.js varmuuden vuoksi ---
vi.mock("enquire.js", () => {
  const noop = () => {};
  const api = { register: noop, unregister: noop, unregisterAll: noop };
  return { __esModule: true, default: api, register: noop, unregister: noop, unregisterAll: noop };
});