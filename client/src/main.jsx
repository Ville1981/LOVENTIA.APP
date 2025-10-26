// PATH: client/src/main.jsx

// --- REPLACE START: ensure i18n is loaded before React tree (single init only) ---
import "./i18n"; // load i18n once; DO NOT also import "./i18n/config"
// --- REPLACE END ---
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

/* --- REPLACE START: load Tailwind utilities BEFORE other CSS so utility classes exist --- */
import "./index.css";   // <- Tailwind entry (@tailwind base/components/utilities)
/* --- REPLACE END --- */

import "./global.css";
// import "./i18n/config"; // (removed – duplicated init would override nsSeparator)
import "leaflet/dist/leaflet.css";
import "./styles/ads.css";

import App from "./App";
// NOTE: ConsentBanner is rendered inside App.jsx now (single source of truth)
import { ConsentProvider } from "./components/ConsentProvider.jsx";
import { AuthProvider } from "./contexts/AuthContext";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- REPLACE START: wait for i18n to be initialized before mounting ---
import i18n from "i18next";
// --- REPLACE END ---

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

const queryClient = new QueryClient();

/**
 * Small dev-only overlay fix:
 * - Prevents any `.ad-header`-like promo layer from capturing clicks over the banner.
 * - Ensures consent banner sits above other content during development.
 * This injects a style tag only in DEV; production CSS remains untouched.
 */
function applyDevOverlayFix() {
  if (!import.meta.env.DEV) return;
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

// --- REPLACE START: bootstrap app with i18n-ready + single createRoot ---
function renderApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error('Root element with id="root" not found');
  }

  // Ensure dev overlay fix is applied before first paint
  applyDevOverlayFix();

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

function bootstrapReactApp() {
  // If i18n already initialized, render immediately; otherwise wait for "initialized"
  if (i18n.isInitialized) {
    renderApp();
    return;
  }
  const onReady = () => {
    i18n.off("initialized", onReady);
    renderApp();
  };
  i18n.on("initialized", onReady);
}

const enableMSW = import.meta.env.VITE_ENABLE_MSW === "true";

if (import.meta.env.DEV && enableMSW) {
  import("./mocks/browser")
    .then(({ worker }) =>
      worker.start({
        onUnhandledRequest: "bypass",
      })
    )
    .then(bootstrapReactApp)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("MSW failed to start", err);
      bootstrapReactApp();
    });
} else {
  bootstrapReactApp();
}
// --- REPLACE END ---
