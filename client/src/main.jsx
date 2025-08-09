import React from 'react'
import ReactDOM from 'react-dom/client'

import './global.css'
import './i18n'
import 'leaflet/dist/leaflet.css'
import './styles/ads.css'

import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

// --- REPLACE START: defer React rendering until MSW is ready in development (JS-safe, no TS non-null) ---
function bootstrapReactApp() {
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    throw new Error('Root element with id="root" not found')
  }
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>
  )
}

if (import.meta.env.DEV) {
  import('./mocks/browser')
    .then(({ worker }) =>
      worker.start({
        // Bypass requests without explicit handlers (lets real backend handle them)
        onUnhandledRequest: 'bypass',
      })
    )
    .then(bootstrapReactApp)
    .catch((err) => {
      console.error('MSW failed to start', err)
      // Even if MSW fails, we still want the app to render
      bootstrapReactApp()
    })
} else {
  bootstrapReactApp()
}
// --- REPLACE END ---
