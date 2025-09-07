// File: client/src/__tests__/ConversationCard.test.jsx
// --- REPLACE START ---
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import ConversationCard from '../components/ConversationCard.jsx';

// Use the shared router-aware renderer so <Link> inside the card works.
// It also mounts a minimal i18n instance for translation hooks.
import { renderWithRouter } from './utils/renderWithRouter';

describe('ConversationCard', () => {
  it('renders avatar, name, snippet and unread badge', () => {
    const convo = {
      peerAvatarUrl: 'https://example.com/a.jpg',
      peerName: 'Alice',
      lastMessage: 'Hey there!',
      lastMessageTimestamp: '2023-01-01T12:00:00.000Z',
      unreadCount: 3,
      userId: 'u1',
    };

    renderWithRouter(<ConversationCard convo={convo} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Hey there!')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formats time ago correctly', () => {
    const now = new Date('2023-01-01T12:05:00.000Z');
    const convo = {
      peerName: 'Bob',
      lastMessage: 'Yo!',
      lastMessageTimestamp: '2023-01-01T12:00:00.000Z',
      unreadCount: 0,
      userId: 'u2',
    };

    // Freeze time for a deterministic assertion
    vi.useFakeTimers();
    vi.setSystemTime(now);

    renderWithRouter(<ConversationCard convo={convo} />);

    // Expect something like "5 minutes ago" (exact wording depends on the utility used)
    expect(screen.getByText(/5.*minute.*ago/i)).toBeInTheDocument();

    // Restore timers
    vi.useRealTimers();
  });
});
// --- REPLACE END ---
