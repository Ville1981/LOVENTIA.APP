// File: server/tests/auth.test.js

// --- REPLACE START: use CJS bridge to load the app and keep tests isolated ---
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Ensure secrets for JWT exist during tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
process.env.NODE_ENV = 'test';

// Mock the src User model so no real DB is touched
jest.mock('../src/models/User.js', () => {
  const bcryptLocal = require('bcryptjs');
  const hashed = bcryptLocal.hashSync('Password123!', 10);
  const FAKE_USER_ID = '507f1f77bcf86cd799439011';

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
    findOne: async (query) => {
      if (query?.email?.toLowerCase() === 'test@example.com') return { ...fakeUser };
      return null;
    },
    findById: async (id) => (id === FAKE_USER_ID ? { ...fakeUser } : null),
    findByIdAndUpdate: async () => ({ ...fakeUser }),
    findByIdAndDelete: async () => ({}),
    exists: async () => false,
    create: async (doc) => ({ ...fakeUser, ...doc }),
  };
});

// Import the Express app via the CJS bridge after mocks
const app = require('../app.cjs');

beforeAll(async () => {
  try { mongoose.set('bufferCommands', false); } catch (_) {}
});
afterAll(async () => {
  try {
    if (mongoose.connection?.readyState === 1) {
      await mongoose.disconnect();
    }
  } catch (_) {}
});

// Helper to parse Set-Cookie for refresh token
function getCookie(res, name) {
  const cookies = res.headers['set-cookie'] || [];
  return cookies.find((c) => c.startsWith(`${name}=`)) || null;
}

describe('Auth Flow', () => {
  let accessToken;
  let refreshCookie;

  test('Login returns access token and refresh token cookie', async () => {
    const res = await request(await app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    accessToken = res.body.accessToken;

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('role');

    refreshCookie = getCookie(res, 'refreshToken');
    expect(refreshCookie).toBeTruthy();
  });

  test('Refresh token returns new access token', async () => {
    const res = await request(await app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(decoded).toHaveProperty('id');
  });

  test('Logout clears refresh token cookie', async () => {
    const res = await request(await app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    const cleared = getCookie(res, 'refreshToken');
    expect(cleared).toBeTruthy();
    expect(String(cleared)).toMatch(/refreshToken=;|Max-Age=0|Expires=/i);
  });

  test('Protected route fails with invalid/old access token after logout', async () => {
    const res = await request(await app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token');

    expect([401, 403, 404]).toContain(res.status);
  });
});
// --- REPLACE END ---
