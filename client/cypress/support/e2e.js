// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// You can put global configuration and behavior that modifies Cypress here.
// ***********************************************************

// Import custom commands
import './commands';

// Ignore application preventDefault errors in filter handler
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('preventDefault is not a function')) {
    return false;
  }
  // Let other errors fail the test
});
