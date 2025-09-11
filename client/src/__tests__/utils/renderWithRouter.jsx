// File: client/src/tests/utils/renderWithRouter.jsx
// Utility to render components wrapped in a React Router context for tests.
// Keeps tests concise and prevents "useNavigate/Link used outside a <Router)" errors.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Re-export helpful testing-library utilities so tests can import from one place.
// --- REPLACE START: remove duplicate export of screen ---
export * from '@testing-library/react';
// screen is already included in the line above, so no need to re-export separately
// --- REPLACE END ---

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
