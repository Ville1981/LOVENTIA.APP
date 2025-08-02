// File: src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// ✅ Global CSS **must** come first
import './global.css';

import App from './App';
import './i18n';
import 'leaflet/dist/leaflet.css';
import './styles/ads.css';

import { AuthProvider } from './context/AuthContext';

// --- REPLACE START: MSW setup (run before React mounts) ---
if (import.meta.env.DEV) {
  import('./mocks/browser')
    .then(({ worker }) => {
      // worker.stop()  // if you want real API instead of mocks
      worker.start({ onUnhandledRequest: 'bypass' });
    })
    .catch((err) => {
      console.error('MSW failed to start', err);
    });
}
// --- REPLACE END ---

// --- REPLACE START: React‑Query setup ---
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();
// --- REPLACE END ---

const root = ReactDOM.createRoot(document.getElementById('root'));
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
