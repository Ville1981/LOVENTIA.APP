// PATH: client/src/main.jsx

// --- REPLACE START: Single, clean bootstrap (no double Router/QueryClient), i18n-first, optional MSW ---
import "./i18n"; // Initialize i18n once at app start

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";

import "./global.css";
import "leaflet/dist/leaflet.css";
import "./styles/ads.css";

// App root (App.jsx already owns the Router + its own QueryClientProvider)
import App from "./App.jsx";

// Auth + consent providers should live at the top; keep only one instance
import { AuthProvider } from "./contexts/AuthContext";
import { ConsentProvider } from "./components/ConsentProvider.jsx";
import ConsentBanner from "./components/ConsentBanner.jsx";

// Root render (no BrowserRouter here, App.jsx already handles routing)
function renderApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error('Root element with id="root" not found');
  const root = ReactDOM.createRoot(rootEl);

  root.render(
    <React.StrictMode>
      <AuthProvider>
        <ConsentProvider>
          {/* Keep Suspense even if not strictly required (translations, lazy routes) */}
          <Suspense fallback={null}>
            <App />
          </Suspense>
          {/* Render banner once at the top level so it's available site-wide */}
          <ConsentBanner />
        </ConsentProvider>
      </AuthProvider>
    </React.StrictMode>
  );
}

// Defer mounting until i18n is ready to avoid flashing untranslated strings
function bootstrap() {
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

// Optional: Mock Service Worker in dev when explicitly enabled
const enableMSW =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_ENABLE_MSW === "true" ||
      import.meta.env.VITE_MSW === "1")) ||
  false;

if (import.meta.env?.DEV && enableMSW) {
  import("./mocks/browser")
    .then(({ worker }) =>
      worker.start({
        onUnhandledRequest: "bypass",
      })
    )
    .then(bootstrap)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[MSW] failed to start:", err);
      bootstrap();
    });
} else {
  bootstrap();
}
// --- REPLACE END ---
