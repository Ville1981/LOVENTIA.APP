// File: server/tests/app.test.js

// --- REPLACE START: use CJS SuperTest helper instead of app.cjs/app.js ---
'use strict';

const request = require('supertest');
// Load the Express app via the CJS SuperTest helper (synchronous Express instance)
const app = require('./helpers/supertestApp.cjs');

describe('API Endpoints (via CJS helper)', () => {
  describe('GET /api/users (mock discover)', () => {
    it('should return an array of users with Bunny', async () => {
      const res = await request(app)
        .get('/api/users')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name', 'Bunny');
    });
  });

  describe('Unknown route', () => {
    it('should return 404 for non-existing endpoint', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });
});
// --- REPLACE END ---
