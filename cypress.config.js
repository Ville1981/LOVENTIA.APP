import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // Base URL of your development server
    baseUrl: 'http://localhost:5174',
    // Spec pattern to include integration tests
    specPattern: 'cypress/integration/**/*.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
