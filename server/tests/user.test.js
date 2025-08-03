import request from 'supertest';
import app from '../src/index.js';
describe('Auth endpoints', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'pass123' });
    expect(res.statusCode).toEqual(201);
  });
});
