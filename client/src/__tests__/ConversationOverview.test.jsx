// File: src/__tests__/ConversationOverview.test.jsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationOverview from '../components/ConversationsOverview';
import messageService from '../services/messageService';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../services/messageService');

describe('ConversationOverview', () => {
  const mockConvos = [
    {
      userId: '1',
      avatarUrl: '/img/1.jpg',
      displayName: 'Alice',
      lastMessageSnippet: 'Hello',
      lastMessageTimestamp: new Date().toISOString(),
      unreadCount: 2,
    },
  ];

  beforeEach(() => {
    messageService.fetchOverview.mockResolvedValue(mockConvos);
  });

  it('renders loading state then list', async () => {
    render(
      <BrowserRouter>
        <ConversationOverview />
      </BrowserRouter>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });
  });

  it('handles empty list', async () => {
    messageService.fetchOverview.mockResolvedValue([]);
    render(
      <BrowserRouter>
        <ConversationOverview />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/start chatting/i)).toBeInTheDocument();
    });
  });

  it('shows error on fetch failure', async () => {
    messageService.fetchOverview.mockRejectedValue(new Error('fail'));
    render(
      <BrowserRouter>
        <ConversationOverview />
      </BrowserRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/failed to load conversations/i)).toBeInTheDocument();
    });
  });
});