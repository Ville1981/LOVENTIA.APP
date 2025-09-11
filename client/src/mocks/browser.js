// File: client/src/mocks/browser.js

/*
  Mock Service Worker (MSW) setup in development.
  Replacement regions are marked between:
    // --- REPLACE START …
    // --- REPLACE END
*/

// --- REPLACE START: conditional export to avoid importing MSW during tests ---
/**
 * In tests:
 *  - Do NOT import 'msw/browser' at all (prevents web-runner resolve/fetch timeouts).
 *  - Export a lightweight stub that exposes the same surface used by the app.
 *
 * In dev (non-test):
 *  - Lazy-import setupWorker and handlers to avoid side effects at module load.
 *  - Do NOT auto-start here; the app decides when to call worker.start().
 */

let worker;

const isTest =
  typeof globalThis !== "undefined" &&
  (globalThis.__VITEST__ || (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test"));

if (isTest) {
  // Lightweight stub to satisfy imports during Vitest runs
  worker = {
    start: async () => undefined,
    stop: async () => undefined,
    use: () => undefined,
    resetHandlers: () => undefined,
    printHandlers: () => undefined,
  };
} else {
  // Lazy ESM imports only in non-test environments
  const { setupWorker } = await import("msw/browser");
  const { handlers } = await import("./handlers");
  worker = setupWorker(...handlers);
}

export { worker };
// --- REPLACE END ---
