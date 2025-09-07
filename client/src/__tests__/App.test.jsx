// File: client/src/__tests__/App.test.jsx
// --- REPLACE START ---
// Ensure jest-dom matchers are available for Vitest
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App.jsx';

// Import the real i18n setup so hooks like useTranslation() have an instance.
// NOTE: This assumes your app's i18n is exported from client/src/i18n.js
import '../i18n.js';

describe('App smoke test', () => {
  it('renders main heading', async () => {
    render(<App />);
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });
});
// --- REPLACE END ---
