// server/tests/app.test.js

const request = require('supertest');
const app = require('../app');

describe('API Endpoints (server/app.js)', () => {
  describe('GET /api/users (mock discover)', () => {
    it('should return an array of users with Bunny', async () => {
      const res = await request(app).get('/api/users').expect('Content-Type', /json/).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name', 'Bunny');
    });
  });

  describe('Unknown route', () => {
    it('should return 404 for non-existing endpoint', async () => {
      await request(app).get('/api/nonexistent').expect(404);
    });
  });
});
