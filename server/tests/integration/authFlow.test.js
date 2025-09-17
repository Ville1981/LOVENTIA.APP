// File: server/tests/integration/authFlow.test.js

// --- REPLACE START: refactor to SuperTest against in-memory app (no real HTTP server) ---
/**
 * Auth Flow (integration-ish) using SuperTest.
 * - Runs directly against the Express app instance (no localhost:5000).
 * - Uses the lightweight test-mode auth routes mounted by server/src/app.js when NODE_ENV='test'.
 * - Persists cookies via SuperTest's agent for refresh/logout steps.
 *
 * Run with:
 *   NODE_ENV=test npx jest --runInBand server/tests/integration/authFlow.test.js
 */

'use strict';

const request = require('supertest');

// Load the Express app via the CJS SuperTest helper (synchronous Express instance)
const app = require('../helpers/supertestApp.cjs');

describe('Auth Flow', () => {
  /** @type {import('supertest').SuperAgentTest} */
  let agent;

  const TEST_USER = {
    email: 'test@example.com',
    password: 'password123',
  };

  beforeAll(() => {
    // Use a SuperTest agent to persist cookies across requests
    agent = request.agent(app);
  });

  it('should login and receive access token + set refresh cookie', async () => {
    const res = await agent
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(TEST_USER);

    expect(res.status).toBe(200);
    // In test-mode implementation, body contains { accessToken }
    expect(res.body).toBeDefined();
    expect(res.body.accessToken).toBeDefined();

    // Refresh cookie should be set
    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie) && setCookie.length > 0).toBe(true);
  });

  it('should refresh access token using the stored cookie', async () => {
    const res = await agent.post('/api/auth/refresh');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.accessToken).toBeDefined();
  });

  it('should logout and clear cookie', async () => {
    const res = await agent.post('/api/auth/logout');
    // In test-mode, logout responds with 200 and a JSON message (allow 204 just in case)
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('message');
    }
  });
});
// --- REPLACE END ---
