// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// ✅ Global CSS **must** come first
import './global.css';

import App from './App';
import './i18n';
import 'leaflet/dist/leaflet.css';
import './styles/ads.css';

import { AuthProvider } from './context/AuthContext';

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END  
// so you can verify exactly what changed.

// --- REPLACE START: MSW setup (run before React mounts) ---
if (import.meta.env.DEV) {
  import('./mocks/browser')
    .then(({ worker }) => {
      // disable MSW in dev if you prefer real API calls:
      // worker.stop();
      worker.start({ onUnhandledRequest: 'bypass' });
    })
    .catch(err => {
      console.error('MSW failed to start', err);
    });
}
// --- REPLACE END ---

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

