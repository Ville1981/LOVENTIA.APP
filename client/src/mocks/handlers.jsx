// File: src/mocks/handlers.jsx

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

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

// Mock user data for auth
const mockUser = {
  id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
};

// --- REPLACE START: add auth endpoint handlers ---
// Handler for POST /api/auth/login
const loginHandler = rest.post('/api/auth/login', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json({ accessToken: 'fakeAccessToken' })
  );
});

// Handler for POST /api/auth/refresh
const refreshHandler = rest.post('/api/auth/refresh', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json({ accessToken: 'fakeRefreshToken' })
  );
});

// Handler for POST /api/auth/logout
const logoutHandler = rest.post('/api/auth/logout', (req, res, ctx) => {
  return res(
    ctx.status(200)
  );
});

// Handler for GET /api/auth/me
const meHandler = rest.get('/api/auth/me', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json(mockUser)
  );
});
// --- REPLACE END ---

// Export named handlers array for MSW
export const handlers = [
  // Handler for GET /api/messages/overview
  rest.get('/api/messages/overview', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockConversations)
    );
  }),
  // --- REPLACE START: include auth handlers in exported array ---
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  // --- REPLACE END ---
];
