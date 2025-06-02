import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // ✅ käytä tätä, ei Routes.jsx
import './global.css';
import "leaflet/dist/leaflet.css";
import "./i18n";
// src/index.js TAI src/main.jsx
import './styles/ads.css';


import { AuthProvider } from "./context/AuthContext";

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <App /> {/* ✅ tämä sisältää Router + Routes sisällön */}
    </AuthProvider>
  </React.StrictMode>
);
