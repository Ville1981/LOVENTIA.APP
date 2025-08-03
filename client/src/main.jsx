// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";

// Styles
import "./global.css";
import "./i18n";
import "leaflet/dist/leaflet.css";
import "./styles/ads.css";

// Context
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

// Components/Layout

// MSW mocks
// --- REPLACE START: MSW setup (run before React mounts) ---
if (import.meta.env.DEV) {
  import("./mocks/browser")
    .then(({ worker }) => {
      // worker.stop()  // if you want real API instead of mocks
      worker.start({ onUnhandledRequest: "bypass" });
    })
    .catch((err) => {
      console.error("MSW failed to start", err);
    });
}
// --- REPLACE END ---

// React-Query
// --- REPLACE START: React-Query setup ---
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
// --- REPLACE END ---

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* --- REPLACE START: wrap App in QueryClientProvider --- */}
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
    {/* --- REPLACE END --- */}
  </React.StrictMode>
);
