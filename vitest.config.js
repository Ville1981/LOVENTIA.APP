// vitest.config.js
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // JSDOM, jotta window ym. toimivat
    environment: 'jsdom',

    // Käytä globaaleja (describe/it/expect)
    globals: true,

    // Ajetaan vain clientin unit/component -testit
    include: ['client/src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],

    // Poissuljetaan kaikki ei-unitit ja snapshot-kansiot
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '_diag/**',
      '**/performance/**',
      'client/performance/**',
      'server/**', // kaikki serverin testit erikseen myöhemmin
      'client/src/__tests__/conversations.spec.js', // Cypress E2E
    ],

    // Ajetaan alustukset ennen testejä
    setupFiles: ['tests/setup/vitest.setup.js'],
  },

  // Alias-tuki ja Reactin dedupe, jotta ei tule kahta Reactia testiajoon
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    alias: {
      // jos testit viittaavat virheellisesti "../utils/i18n",
      // ohjataan se todelliseen i18n-toteutukseen tai stubiin
      '../utils/i18n': path.resolve(__dirname, 'client/src/i18n.js'),
      '@src': path.resolve(__dirname, 'client/src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
});
