// File: client/src/tests/ProtectedRoute.test.jsx
// --- REPLACE START ---
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute.jsx';

// Use the shared router-aware renderer and re-exported screen
import { renderWithRouter, screen } from './utils/renderWithRouter';

// Mock AuthContext to align with current ProtectedRoute API ({ user, bootstrapped })
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../contexts/AuthContext';

function Protected() {
  return <div>Protected Content</div>;
}
function LoginPage() {
  return <div>Login Page</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  it('redirects to /login when user is null and bootstrapped is true', () => {
    useAuth.mockReturnValue({ user: null, bootstrapped: true });

    renderWithRouter(
      <Routes>
        {/* Route for login must exist to handle redirect */}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <Protected />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/protected'] }
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user exists and bootstrapped is true', () => {
    useAuth.mockReturnValue({ user: { id: 'x' }, bootstrapped: true });

    renderWithRouter(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <Protected />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/protected'] }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
// --- REPLACE END ---
