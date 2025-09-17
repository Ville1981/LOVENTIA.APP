// File: server/tests/utils/testApp.js

// --- REPLACE START ---
/**
 * Import the Express app without starting the HTTP server.
 * We try common export shapes: default export or named 'app'.
 */
import mod from "../../app.js";
const app = mod?.default || mod?.app || mod;

if (!app || typeof app.use !== "function") {
  throw new Error(
    "tests/utils/testApp: Could not load Express app from server/app.js (export default app;)."
  );
}

export default app;
// --- REPLACE END ---
