import React from "react";
import ReactDOM from "react-dom/client";

// Styles & i18n
import "./global.css";
import "./i18n";
import "leaflet/dist/leaflet.css";
import "./styles/ads.css";

// App & Context
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";

// React-Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();

// --- REPLACE START: defer React rendering until MSW is ready in development ---
function bootstrapReactApp() {
  const root = ReactDOM.createRoot(document.getElementById("root"));
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

if (import.meta.env.DEV) {
  import("./mocks/browser")
    .then(({ worker }) => {
      return worker.start({
        serviceWorker: {
          url: "/mockServiceWorker.js",
        },
        onUnhandledRequest: "bypass",
      });
    })
    .then(() => {
      // After MSW has started, render the app
      bootstrapReactApp();
    })
    .catch((err) => {
      console.error("MSW failed to start", err);
      // Even if MSW fails, still boot the app to avoid blocking
      bootstrapReactApp();
    });
} else {
  // In production, just render immediately
  bootstrapReactApp();
}
// --- REPLACE END ---
