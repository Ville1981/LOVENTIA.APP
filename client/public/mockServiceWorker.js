/**
 * Mock Service Worker (MSW) - Service Worker file
 * This file intercepts network requests based on the handlers defined in your client code.
 *
 * NOTE: This is a minimal stub. To generate the full, official service worker script,
 * run the following command in your project root:
 *
 *   npx msw init public/ --save
 *
 * The command will copy the complete `mockServiceWorker.js` into this `public/` folder.
 */

// Install event: skip waiting to activate the new service worker immediately
self.addEventListener('install', () => self.skipWaiting())

// Activate event: take control of uncontrolled clients
self.addEventListener('activate', () => self.clients.claim())

// Fetch event: handlers will be injected by MSW runtime in development
self.addEventListener('fetch', (event) => {
  // Placeholder: MSW will override this handler in development mode.
  // If requests aren't being intercepted, regenerate this file by running:
  //   npx msw init public/ --save
})
