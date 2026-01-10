// PATH: client/src/main.jsx
// File: client/src/main.jsx

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

/* --- REPLACE START: load Tailwind BEFORE other CSS so utilities exist (Tailwind v4 entry) --- */
import "./index.css"; // Tailwind entry (v4): @import "tailwindcss";
/* --- REPLACE END --- */

/* --- REPLACE START: global custom styles (must NOT contain @tailwind directives) --- */
import "./global.css"; // Custom global styles only (no @tailwind base/components/utilities)
/* --- REPLACE END --- */

// import "./i18n/config"; // (removed – duplicated init would override nsSeparator)
// --- REPLACE START: remove Leaflet CSS from global entry (keep it route-scoped in MapPage) ---
// import "leaflet/dist/leaflet.css";
// NOTE: Leaflet CSS is imported in client/src/pages/MapPage.jsx to keep homepage bundle lean.
// --- REPLACE END ---
import "./styles/ads.css";

import App from "./App";
// NOTE: ConsentBanner is rendered inside App.jsx now (single source of truth)
import { ConsentProvider } from "./components/ConsentProvider.jsx";

/* --- REPLACE START: AuthProvider must be a STATIC import to avoid mixed dynamic+static import warning (Vite) --- */
/**
 * Why this change:
 * - Vite warned: AuthContext is dynamically imported by main.jsx but ALSO statically imported by App.jsx and many others.
 * - In that case, dynamic import cannot move it into a separate chunk anyway.
 * - So we keep the behavior identical but remove the pointless dynamic import to silence the warning and simplify boot.
 */
import { AuthProvider } from "./contexts/AuthContext";
/* --- REPLACE END --- */

/* --- REPLACE START: avoid static imports that force big deps into the initial chunk (JS-bundle hygiene 6.7) --- */
/**
 * Why this change:
 * - Static imports in the root entry tend to end up inside the initial `index-*.js`.
 * - We want to keep the UI identical, but reduce initial JS by moving heavy deps into split chunks.
 * - We still guarantee these providers are ready BEFORE the React tree mounts (no flicker / no missing providers).
 *
 * Targets:
 * - @tanstack/react-query (QueryClient, QueryClientProvider)
 *
 * NOTE:
 * - AuthProvider is intentionally NOT a target anymore:
 *   It is already statically imported elsewhere (App.jsx + many components), so dynamic import here is ineffective.
 */
let QueryClientProviderComponent = null;
let queryClient = null;

async function ensureProvidersReady() {
  // 1) React Query (move out of initial entry chunk)
  if (!QueryClientProviderComponent || !queryClient) {
    const rq = await import("@tanstack/react-query");
    QueryClientProviderComponent = rq.QueryClientProvider;
    queryClient = new rq.QueryClient();
  }

  // 2) AuthProvider
  // AuthProvider is statically imported (see REPLACE block above) to avoid Vite mixed import warning.
  // Keeping this comment here preserves the original boot intent and makes the change obvious during future audits.
}
/* --- REPLACE END --- */

/**
 * File: client/src/main.jsx (root render)
 * NOTE:
 * - Previous version mounted the app TWICE (two createRoot() calls), which caused
 *   click issues under overlays (cookie banner not clickable, etc.).
 * - We now mount the app ONCE via renderApp()/bootstrapReactApp().
 * - The old immediate createRoot block is intentionally removed to prevent double-mount.
 */

// --- REPLACE START: removed duplicate immediate mount (kept as comment for diff visibility) ---
// import ConsentBanner from "./components/ConsentBanner.jsx";
// ReactDOM.createRoot(document.getElementById("root")).render(
//   <React.StrictMode>
//     <ConsentProvider>
//       <App />
//       {/* Place near root so it's visible everywhere */}
//       <ConsentBanner />
//     </ConsentProvider>
//   </React.StrictMode>
// );
// --- REPLACE END ---

/**
 * Small dev-only overlay fix:
 * - Prevents any `.ad-header`-like promo layer from capturing clicks over the banner.
 * - Ensures consent banner sits above other content during development.
 * This injects a style tag only in DEV; production CSS remains untouched.
 */
function applyDevOverlayFix() {
  if (!import.meta.env.DEV) return;

  // --- REPLACE START: avoid injecting duplicate <style> tags during HMR ---
  if (document.querySelector('style[data-dev-overlay-fix="true"]')) return;
  // --- REPLACE END ---

  const css = `
  /* Dev-only overlay guard */
  .ad-header, .ad, .promo, .hero-overlay {
    pointer-events: none !important;
  }
  #cookie-banner, .cookie-banner, [data-consent-banner], .cc-window, .cookies {
    position: relative;
    z-index: 2147483647 !important;
  }
  `;
  const el = document.createElement("style");
  el.setAttribute("data-dev-overlay-fix", "true");
  el.appendChild(document.createTextNode(css));
  document.head.appendChild(el);
}

/**
 * MSW gate (single source of truth):
 * - Enable ONLY in DEV and only when VITE_MSW=1.
 * - No MSW bootstrapping exists in App.jsx (prevents duplicate starts).
 */
const enableMSW = import.meta.env.VITE_MSW === "1";

/* --- REPLACE START: lazy-load i18n to reduce initial JS (keeps i18n ready before mounting) --- */
/**
 * Why this change:
 * - i18n init often pulls in backend + language detector (and related deps) into the initial chunk.
 * - For JS-bundle hygiene (6.7), we load i18n via dynamic import so it can be split into its own chunk.
 * - We still guarantee i18n is initialized BEFORE the React tree mounts (no UI flicker / missing translations).
 */
async function ensureI18nReady() {
  // --- REPLACE START: use explicit path to avoid accidental directory import ("./i18n" vs "./i18n.js") ---
  const mod = await import("./i18n.js");
  const inst = mod?.default;

  // Sanity check: react-i18next expects an i18next instance with .on/.off.
  // If this is not true, LanguageSwitcher can crash with "i18n.on is not a function".
  if (!inst || typeof inst.on !== "function") {
    throw new Error(
      "i18n did not initialize correctly (expected i18next instance with .on). Check client/src/i18n.js export/default."
    );
  }
  // --- REPLACE END ---
}

/**
 * Render the React app exactly once.
 * Assumes i18n and providers have been initialized already (ensureI18nReady + ensureProvidersReady called before).
 */
function renderApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error('Root element with id="root" not found');
  }

  // Ensure dev overlay fix is applied before first paint
  applyDevOverlayFix();

  // Provider readiness guard (should already be true if bootstrap order is respected)
  if (!QueryClientProviderComponent || !queryClient) {
    throw new Error(
      "React Query provider is not ready (ensureProvidersReady not awaited)"
    );
  }

  const QueryClientProvider = QueryClientProviderComponent;

  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <ConsentProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Suspense can stay even if not strictly required */}
            <Suspense fallback={null}>
              <App />
              {/* ConsentBanner is mounted inside App.jsx to avoid duplication */}
            </Suspense>
          </AuthProvider>
        </QueryClientProvider>
      </ConsentProvider>
    </React.StrictMode>
  );
}

/**
 * Bootstrap order (safe + deterministic):
 * 1) Optional MSW start (dev only)
 * 2) Ensure i18n is loaded + initialized
 * 3) Ensure providers are ready (react-query)
 * 4) Mount React app (single createRoot)
 */
async function bootstrapReactApp() {
  await ensureI18nReady();
  await ensureProvidersReady();
  renderApp();
}

async function start() {
  if (import.meta.env.DEV && enableMSW) {
    try {
      const mod = await import("./mocks/browser");
      await mod.startWorker({ onUnhandledRequest: "bypass" });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("MSW failed to start", err);
      // Continue without MSW
    }
  }

  try {
    await bootstrapReactApp();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("App bootstrap failed", err);
    throw err;
  }
}

start();
/* --- REPLACE END --- */

