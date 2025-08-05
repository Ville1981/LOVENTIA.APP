// File: src/mocks/handlers.jsx

// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

// Disable ESLint named-import error for MSW
// eslint-disable-next-line import/named
// --- REPLACE START: import http from MSW as top‐level ESM export ---
import { http } from 'msw';
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

// --- REPLACE START: ensure MSW sets a refreshToken cookie on login/refresh ---
const cookieSettings = {
  path: '/',         // must match backend configuration
  sameSite: 'None',  // allow cross-site usage
  secure: false,     // set to true in production
};

const loginHandler = http.post('/api/auth/login', (req, res, ctx) => {
  const fakeToken = 'fakeRefreshToken';
  return res(
    ctx.cookie('refreshToken', fakeToken, cookieSettings),
    ctx.status(200),
    ctx.json({ accessToken: 'fakeAccessToken' })
  );
});

const refreshHandler = http.post('/api/auth/refresh', (req, res, ctx) => {
  const newFakeToken = 'rotatedFakeRefreshToken';
  return res(
    ctx.cookie('refreshToken', newFakeToken, cookieSettings),
    ctx.status(200),
    ctx.json({ accessToken: 'fakeAccessToken' })
  );
});
// --- REPLACE END ---

// --- REPLACE START: replace old rest handlers with http versions ---
const logoutHandler = http.post('/api/auth/logout', (req, res, ctx) => {
  return res(
    ctx.status(200),
    // clear the cookie so browser forgets it
    ctx.cookie('refreshToken', '', { ...cookieSettings, maxAge: 0 })
  );
});

const meHandler = http.get('/api/auth/me', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json(mockUser)
  );
});
// --- REPLACE END ---

export const handlers = [
  // messages overview
  http.get('/api/messages/overview', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockConversations)
    );
  }),

  // Inject our auth handlers
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
];
