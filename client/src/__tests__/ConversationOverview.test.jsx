// File: src/__tests__/ConversationsOverview.test.jsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationsOverview from '../components/ConversationsOverview';
import messageService from '../services/messageService';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../services/messageService');

describe('ConversationsOverview', () => {
  const mockConvos = [
    {
      userId: '1',
      avatarUrl: '/img/1.jpg',
      displayName: 'Alice',
      snippet: 'Hello',
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 2,
    },
  ];

  beforeEach(() => {
    messageService.getOverview.mockResolvedValue(mockConvos);
  });

  it('renders loading state then list', async () => {
    render(
      <BrowserRouter>
        <ConversationsOverview />
      </BrowserRouter>
    );

    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });
  });

  it('handles empty list', async () => {
    messageService.getOverview.mockResolvedValue([]);
    render(
      <BrowserRouter>
        <ConversationsOverview />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/start chatting/i)).toBeInTheDocument();
    });
  });

  it('shows error on fetch failure', async () => {
    messageService.getOverview.mockRejectedValue(new Error('fail'));
    render(
      <BrowserRouter>
        <ConversationsOverview />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load conversations/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
