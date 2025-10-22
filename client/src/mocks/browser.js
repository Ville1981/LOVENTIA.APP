// File: client/src/mocks/browser.js

/*
  Mock Service Worker (MSW) setup in development.
  Replacement regions are marked between:
    // --- REPLACE START …
    // --- REPLACE END
*/

// --- REPLACE START: remove top-level await; keep test stub & lazy load ---
/**
 * Goals:
 *  - In tests: do NOT import 'msw/browser' (prevents network/timeouts in CI).
 *    Export a lightweight stub with the same surface used by the app.
 *  - In non-test envs: lazy-import MSW and handlers without top-level await,
 *    so production build works with esbuild targets that disallow it.
 *  - Do NOT auto-start here; the app decides when to call worker.start().
 */

let worker;

/** Detect test mode for Vitest/Jest without throwing in non-module contexts. */
const isTest =
  typeof globalThis !== "undefined" &&
  (globalThis.__VITEST__ ||
    (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test"));

if (isTest) {
  // Lightweight stub to satisfy imports during tests
  worker = {
    start: async () => undefined,
    stop: async () => undefined,
    use: () => undefined,
    resetHandlers: () => undefined,
    printHandlers: () => undefined,
  };
} else {
  // Lazy-load MSW in an IIFE to avoid top-level await
  (async () => {
    try {
      const { setupWorker } = await import("msw/browser");
      const { handlers } = await import("./handlers");
      worker = setupWorker(...handlers);
      // Note: do not call worker.start() here; the app controls start timing.
    } catch (err) {
      // Do not break the app if MSW fails to initialize in prod builds
      // eslint-disable-next-line no-console
      console.warn("[msw] Failed to initialize service worker:", err);
    }
  })();
}

export { worker };
// --- REPLACE END ---
