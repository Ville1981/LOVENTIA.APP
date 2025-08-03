// client/src/__tests__/ProtectedRoute.test.jsx
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

// Helper components
const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Login Page</div>;

describe('ProtectedRoute', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('redirects to /login when no token is present', () => {
    // No token in localStorage
    const { queryByText } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginComponent />} />
        </Routes>
      </MemoryRouter>
    );

    // Should render LoginComponent
    expect(queryByText('Login Page')).toBeInTheDocument();
    // Protected content should not be in document
    expect(queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when token is present', () => {
    // Set a dummy token in localStorage
    localStorage.setItem('token', 'dummy-token');

    const { queryByText } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginComponent />} />
        </Routes>
      </MemoryRouter>
    );

    // Should render protected content
    expect(queryByText('Protected Content')).toBeInTheDocument();
    // Should not render login page
    expect(queryByText('Login Page')).not.toBeInTheDocument();
  });
});
