// File: client/src/__tests__/Login.test.jsx
// --- REPLACE START ---
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import { vi } from 'vitest';

// Mock AuthContext hook so we can control login() behavior
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../contexts/AuthContext';

describe('Login Page', () => {
  const loginMock = vi.fn();

  beforeEach(() => {
    // Provide the mocked login() to the component under test
    useAuth.mockReturnValue({ login: loginMock });
    loginMock.mockReset();
  });

  it('renders email and password inputs and submit button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log in/i })
    ).toBeInTheDocument();
  });

  it('logs in successfully and navigates to profile', async () => {
    // AuthContext.login resolves when credentials are accepted
    loginMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Assert AuthContext.login was called with email & password
    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith('a@b.com', 'pass')
    );

    // Success message should appear
    expect(
      screen.getByText(/login successful!/i)
    ).toBeInTheDocument();
  });

  it('displays error message on login failure', async () => {
    // Make AuthContext.login reject with an error
    loginMock.mockRejectedValue(new Error('Invalid'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Error message from the thrown Error should be shown
    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
  });
});
// --- REPLACE END ---
