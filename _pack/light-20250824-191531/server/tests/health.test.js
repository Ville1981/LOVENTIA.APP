// server/tests/health.test.js
import request from 'supertest';
import app from '../src/app';  // varmista, että app exporttaa Express-instan sinä käytät

describe('GET /health', () => {
  it('should return status 200 and OK body', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('OK');
  });
});
