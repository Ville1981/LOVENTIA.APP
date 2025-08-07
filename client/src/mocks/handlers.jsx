// src/mocks/handlers.jsx
// The replacement region is marked between // --- REPLACE START and // --- REPLACE END so you can verify exactly what changed

// --- REPLACE START: import stable REST API from MSW core entrypoint ---
import { rest } from 'msw'
// --- REPLACE END ---

// Mock data for conversations overview
const mockConversations = [
  {
    userId: 'alice',
    name: 'Alice',
    avatarUrl: '/assets/alice.jpg',
    lastMessageTime: Date.now() - 5 * 60_000, // 5 minutes ago
    snippet: 'Hey, are you free tonight?',
    unreadCount: 2,
  },
  {
    userId: 'bob',
    name: 'Bob',
    avatarUrl: '/assets/bob.jpg',
    lastMessageTime: Date.now() - 2 * 3_600_000, // 2 hours ago
    snippet: 'Got the documents, thanks!',
    unreadCount: 0,
  },
]

// Mock user data for auth
const mockUser = {
  id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
}

// --- REPLACE START: adjust cookie settings for refresh/login ---
const cookieSettings = {
  path: '/',         // must match backend configuration
  sameSite: 'None',  // allow cross-site usage
  secure: false,     // set to true in production
}
// --- REPLACE END ---

// --- REPLACE START: login & refresh handlers using rest.post ---
const loginHandler = rest.post('/api/auth/login', (req, res, ctx) => {
  const fakeToken = 'fakeRefreshToken'
  return res(
    ctx.cookie('refreshToken', fakeToken, cookieSettings),
    ctx.status(200),
    ctx.json({ accessToken: 'fakeAccessToken' })
  )
})

const refreshHandler = rest.post('/api/auth/refresh', (req, res, ctx) => {
  const newFakeToken = 'rotatedFakeRefreshToken'
  return res(
    ctx.cookie('refreshToken', newFakeToken, cookieSettings),
    ctx.status(200),
    ctx.json({ accessToken: 'fakeAccessToken' })
  )
})
// --- REPLACE END ---

// --- REPLACE START: logout & me handlers using rest API ---
const logoutHandler = rest.post('/api/auth/logout', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.cookie('refreshToken', '', { ...cookieSettings, maxAge: 0 })
  )
})

const meHandler = rest.get('/api/auth/me', (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json(mockUser)
  )
})
// --- REPLACE END ---

export const handlers = [
  // messages overview
  rest.get('/api/messages/overview', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockConversations)
    )
  }),

  // auth handlers
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
]
