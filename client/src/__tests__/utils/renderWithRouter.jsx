// File: client/tests/utils/renderWithRouter.jsx
// Utility to render components wrapped in a React Router context for tests.
// Keeps tests concise and prevents "useNavigate/Link used outside a <Router)" errors.

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Re-export helpful testing-library utilities so tests can import from one place.
export * from '@testing-library/react';
export { screen } from '@testing-library/react';

// --- REPLACE START: renderWithRouter helper (drop inner <Routes>/<Route>, pass ui directly) ---
/**
 * Renders the given UI wrapped with a MemoryRouter so that components
 * using <Link>, useNavigate, useParams, etc. work in tests.
 *
 * @param {React.ReactNode} ui - The component to render.
 * @param {Object} [options]
 * @param {string[]} [options.initialEntries] - Initial history stack entries for MemoryRouter.
 * @param {number} [options.initialIndex] - Index into initialEntries to start from.
 * @param {string} [options.route="/"] - Shorthand for a single initial entry.
 * @returns {import('@testing-library/react').RenderResult}
 */
export function renderWithRouter(
  ui,
  { initialEntries, initialIndex, route = '/' } = {}
) {
  const entries = Array.isArray(initialEntries) ? initialEntries : [route];

  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      {ui}
    </MemoryRouter>
  );
}
// --- REPLACE END ---
