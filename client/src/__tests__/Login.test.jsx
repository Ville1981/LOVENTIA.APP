import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/Login';
import api from '../utils/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

// Mock api instance
jest.mock('../utils/axiosInstance', () => ({
  post: jest.fn(),
  interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
}));
jest.mock('../context/AuthContext');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

describe('Login Page', () => {
  const loginMock = jest.fn();
  const navigateMock = jest.fn();

  beforeEach(() => {
    useAuth.mockReturnValue({ login: loginMock });
    useNavigate.mockReturnValue(navigateMock);
    api.post.mockReset();
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  it('renders email and password inputs and submit button', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText('Sähköposti')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Salasana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kirjaudu/i })).toBeInTheDocument();
  });

  it('logs in successfully and navigates to profile', async () => {
    api.post.mockResolvedValue({ data: { token: 'abc123' } });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Sähköposti'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Salasana'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /kirjaudu/i }));

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password',
    });

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('abc123');
      expect(screen.getByText('Kirjautuminen onnistui!')).toBeInTheDocument();
      expect(navigateMock).toHaveBeenCalledWith('/profile');
    });
  });

  it('displays error message on login failure', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Sähköposti'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Salasana'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /kirjaudu/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
