

import React from 'react'
import ReactDOM from 'react-dom/client'

// ✅ Global CSS **must** come first
import './global.css'

import App from './App'
import './i18n'
import 'leaflet/dist/leaflet.css'
import './styles/ads.css'

import { AuthProvider } from './context/AuthContext'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
