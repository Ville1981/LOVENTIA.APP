// client/src/__tests__/Login.test.jsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/Login';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

// Mock axios to support create() used in axiosInstance and post() used in Login
jest.mock('axios', () => {
  const mAxios = {
    create: jest.fn(() => ({
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
    })),
    post: jest.fn()
  };
  return mAxios;
});
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
    axios.post.mockReset();
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
    axios.post.mockResolvedValue({ data: { token: 'abc123' } });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Sähköposti'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Salasana'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /kirjaudu/i }));

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/login',
      { email: 'test@example.com', password: 'password' }
    );

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('abc123');
      expect(screen.getByText('Kirjautuminen onnistui!')).toBeInTheDocument();
      expect(navigateMock).toHaveBeenCalledWith('/profile');
    });
  });

  it('displays error message on login failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } });

    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );

    // Fill in email and password to trigger API call
    fireEvent.change(screen.getByPlaceholderText('Sähköposti'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Salasana'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /kirjaudu/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
