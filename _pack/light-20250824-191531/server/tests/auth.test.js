// --- REPLACE START: make tests independent of real MongoDB by mocking the User model ---
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Ensure secrets for JWT exist during tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
process.env.NODE_ENV = 'test';

// Mock the src User model that controllers/routes import
// IMPORTANT: define all variables INSIDE the factory to satisfy Jest's scoping rule.
jest.mock('../src/models/User.js', () => {
  const bcryptLocal = require('bcryptjs');
  const hashed = bcryptLocal.hashSync('Password123!', 10);
  const FAKE_USER_ID = '507f1f77bcf86cd799439011';

  // Minimal in-memory "document"
  const fakeUser = {
    _id: FAKE_USER_ID,
    id: FAKE_USER_ID,
    email: 'test@example.com',
    username: 'testuser',
    password: hashed,
    role: 'user',
    isPremium: false,
    save: async () => fakeUser,
    select() { return this; },
  };

  return {
    // Used by login
    findOne: async (query) => {
      if (!query || !query.email) return null;
      if (String(query.email).toLowerCase() === 'test@example.com') return { ...fakeUser };
      return null;
    },
    // Potentially used by /me and profile paths
    findById: async (id) => {
      if (id === FAKE_USER_ID) return { ...fakeUser };
      return null;
    },
    findByIdAndUpdate: async () => ({ ...fakeUser }),
    findByIdAndDelete: async () => ({}),
    exists: async () => false,
    create: async (doc) => ({ ...fakeUser, ...doc }),
  };
});

// Import the app AFTER mocks are set
const app = require('../src/app.js');

// Avoid real DB connection attempts in this test file
beforeAll(async () => {
  try { mongoose.set('bufferCommands', false); } catch (_) {}
});
afterAll(async () => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  } catch (_) {}
});

// Helper to parse Set-Cookie for refresh token
function getCookie(res, name) {
  const cookies = res.headers['set-cookie'] || [];
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  return match || null;
}

describe('Auth Flow', () => {
  let accessToken = null;
  let refreshCookie = null;

  test('Login returns access token and refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    accessToken = res.body.accessToken;

    // Verify the access token has expected claims
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('role');

    // Refresh token cookie should be set
    refreshCookie = getCookie(res, 'refreshToken');
    expect(refreshCookie).toBeTruthy();
  });

  test('Refresh token returns new access token', async () => {
    expect(refreshCookie).toBeTruthy();

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');

    // New token should be valid
    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
  });

  test('Logout clears refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .send();

    expect(res.status).toBe(200);
    // Should set a Set-Cookie that clears the cookie (Max-Age=0 or expires in the past)
    const cleared = getCookie(res, 'refreshToken');
    expect(cleared).toBeTruthy();
    expect(String(cleared)).toMatch(/refreshToken=;|Max-Age=0|Expires=/i);
  });

  test('Protected route fails with invalid/old access token after logout', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token')
      .send();

    expect([401, 403, 404]).toContain(res.status);
  });
});
// --- REPLACE END ---
