// File: src/mocks/handlers.jsx

// --- REPLACE START: disable named import lint for MSW ---
// eslint-disable-next-line import/named
import { rest } from 'msw';
// --- REPLACE END ---

// Mock data for conversations overview
const mockConversations = [
  {
    userId: 'alice',
    name: 'Alice',
    avatarUrl: '/assets/alice.jpg',
    lastMessageTime: Date.now() - 5 * 60000, // 5 minutes ago
    snippet: 'Hey, are you free tonight?',
    unreadCount: 2,
  },
  {
    userId: 'bob',
    name: 'Bob',
    avatarUrl: '/assets/bob.jpg',
    lastMessageTime: Date.now() - 2 * 3600000, // 2 hours ago
    snippet: 'Got the documents, thanks!',
    unreadCount: 0,
  },
];

// Export named handlers array for MSW
export const handlers = [
  // Handler for GET /api/messages/overview
  rest.get('/api/messages/overview', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockConversations)
    );
  }),
];
