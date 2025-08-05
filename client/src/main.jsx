// File: src/main.jsx

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

// MSW mocks — must run before any network calls!
if (import.meta.env.DEV) {
  import("./mocks/browser")
    .then(({ worker }) => {
      worker.start({
        serviceWorker: {
          url: "/mockServiceWorker.js",
        },
        onUnhandledRequest: "bypass",
      });
    })
    .catch((err) => {
      console.error("MSW failed to start", err);
    });
}

// React-Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();

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
