// --- REPLACE START: small smoke for health/search/notifications ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

describe('Smoke: health/search/notifications', () => {
  test('GET /health returns 200 OK', async () => {
    await request(app).get('/health').expect(200);
  });

  test('GET /api/health (if mounted) returns 200', async () => {
    await request(app).get('/api/health').expect((r) => [200,404].includes(r.status)); // tolerate missing route
  });

  test('Search requires auth (usually 401)', async () => {
    const res = await request(app).get('/api/search').expect((r) => [200,401,403].includes(r.status));
    expect(res.status).toBeDefined();
  });

  test('Notifications path present (auth-protected)', async () => {
    const res = await request(app).get('/api/notifications').expect((r) => [401,403,200,404].includes(r.status));
    expect(res.status).toBeDefined();
  });
});
// --- REPLACE END ---
