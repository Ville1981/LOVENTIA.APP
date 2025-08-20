// client/src/main.jsx

// --- REPLACE START: ensure i18n is loaded before React tree (single init only) ---
import "./i18n"; // load i18n once; DO NOT also import "./i18n/config"
// --- REPLACE END ---
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

import "./global.css";
// import "./i18n/config"; // (removed – duplicated init would override nsSeparator)
import "leaflet/dist/leaflet.css";
import "./styles/ads.css";

import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- REPLACE START: wait for i18n to be initialized before mounting ---
import i18n from "i18next";
// --- REPLACE END ---

const queryClient = new QueryClient();

// --- REPLACE START: bootstrap app with i18n-ready + optional MSW ---
function renderApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error('Root element with id="root" not found');
  }
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
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
