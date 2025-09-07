// File: client/src/tests/ConversationOverview.test.jsx
// --- REPLACE START ---
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ConversationsOverview from '../pages/ConversationsOverview.jsx';

// Use ONLY the shared router-aware renderer.
import { renderWithRouter } from './utils/renderWithRouter';

// Mock the exact module ConversationsOverview imports
vi.mock('../utils/axiosInstance', () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));

// Import mocked axios so we can control return values
import axios from '../utils/axiosInstance';

describe('ConversationsOverview', () => {
  const mockConvos = [
    {
      userId: '1',
      name: 'Alice',
      avatarUrl: '/a.jpg',
      lastMessageTime: Date.now(),
      snippet: 'Hi',
      unreadCount: 0,
    },
    {
      userId: '2',
      name: 'Bob',
      avatarUrl: '/b.jpg',
      lastMessageTime: Date.now(),
      snippet: 'Hello',
      unreadCount: 1,
    },
  ];

  beforeEach(() => {
    axios.get.mockReset();
  });

  it('renders loading state then list', async () => {
    axios.get.mockResolvedValue({ data: mockConvos });

    renderWithRouter(<ConversationsOverview />);

    // Accessibility: spinner + sr-only text
    expect(
      screen.getByText(/loading conversations/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('handles empty list', async () => {
    axios.get.mockResolvedValue({ data: [] });

    renderWithRouter(<ConversationsOverview />);

    await waitFor(() => {
      // Bunny placeholder shows when empty
      expect(screen.getByText(/bunny/i)).toBeInTheDocument();
    });
  });

  it('shows error on fetch failure', async () => {
    axios.get.mockRejectedValue(new Error('boom'));

    renderWithRouter(<ConversationsOverview />);

    await waitFor(() => {
      expect(
        screen.getByText(/unable to load conversations/i)
      ).toBeInTheDocument();
    });
  });
});
// --- REPLACE END ---
