import React from 'react'
import ReactDOM from 'react-dom/client'

// Styles & i18n
import './global.css'
import './i18n'
import 'leaflet/dist/leaflet.css'
import './styles/ads.css'

// App & Context
import App from './App'
import { AuthProvider } from './contexts/AuthContext'

// React-Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()

// --- REPLACE START: defer React rendering until MSW is ready in development ---
function bootstrapReactApp() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
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
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
        onUnhandledRequest: 'bypass',
      })
    )
    .then(() => {
      bootstrapReactApp()
    })
    .catch((err) => {
      console.error('MSW failed to start', err)
      bootstrapReactApp()
    })
} else {
  bootstrapReactApp()
}
// --- REPLACE END ---
