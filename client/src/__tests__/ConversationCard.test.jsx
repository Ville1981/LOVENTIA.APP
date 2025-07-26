// File: src/__tests__/ConversationCard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import ConversationCard from '../components/ConversationCard';
import { formatDistanceToNowStrict } from 'date-fns';

describe('ConversationCard', () => {
  const data = {
    avatarUrl: '/img/avatar.jpg',
    displayName: 'Bob',
    lastMessageSnippet: 'Test message snippet',
    lastMessageTimestamp: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    unreadCount: 3,
  };

  it('renders avatar, name, snippet and unread badge', () => {
    render(<ConversationCard data={data} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/img/avatar.jpg');
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Test message snippet')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formats time ago correctly', () => {
    render(<ConversationCard data={data} />);
    const ago = formatDistanceToNowStrict(new Date(data.lastMessageTimestamp), { addSuffix: true });
    expect(screen.getByText(ago)).toBeInTheDocument();
  });
});
