// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',  // frontendin dev‐URL
    supportFile: 'cypress/support/index.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx}',
    setupNodeEvents(on, config) {
      // voit laittaa esim. ympäristömuuttujien lataamisen tai reporterit
      return config;
    },
  },
  video: false,  // CI:ssä ei välttämättä tarvita videoita
});
