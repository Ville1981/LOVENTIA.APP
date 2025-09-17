// File: server/tests/user.test.js

// --- REPLACE START: import app via CJS helper and test login endpoint (works in test mode) ---
'use strict';

const request = require('supertest');

// Load the Express app via the CJS SuperTest helper (synchronous Express instance)
const app = require('./helpers/supertestApp.cjs');

describe('Auth endpoints', () => {
  it('should login successfully (returns accessToken)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@example.com', password: 'pass123' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
  });
});
// --- REPLACE END ---
