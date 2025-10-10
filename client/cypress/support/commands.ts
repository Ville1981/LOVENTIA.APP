// File: client/cypress/support/commands.ts

// --- REPLACE START: optional admin login helper (no-op if you already have one) ---
declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginAsAdmin', () => {
  // Update this to match your app's auth storage.
  // Example: localStorage token flag + role
  cy.window().then((win) => {
    try {
      win.localStorage.setItem('authRole', 'admin');
      // win.localStorage.setItem('accessToken', 'dummy-admin-jwt');
    } catch {}
  });
});
// --- REPLACE END ---
