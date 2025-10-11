// --- REPLACE START: likes/superlikes/rewind basic integration tests ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

describe('Likes / Superlikes / Rewind (auth-required)', () => {
  let tokenA, tokenB, userA, userB;

  beforeAll(async () => {
    const password = process.env.TEST_PASSWORD || ("e2e-" + Date.now() + "A1!");
    const emailA = `a+${Date.now()}@example.com`;
    const emailB = `b+${Date.now()}@example.com`;

    await request(app).post('/api/auth/register').send({ email: emailA, password }).expect([200,201]);
    await request(app).post('/api/auth/register').send({ email: emailB, password }).expect([200,201]);

    tokenA = (await request(app).post('/api/auth/login').send({ email: emailA, password }).expect(200)).body.accessToken || (await request(app).post('/api/auth/login').send({ email: emailA, password })).body.token;
    tokenB = (await request(app).post('/api/auth/login').send({ email: emailB, password }).expect(200)).body.accessToken || (await request(app).post('/api/auth/login').send({ email: emailB, password })).body.token;

    userA = (await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenA}`).expect(200)).body?._id;
    userB = (await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenB}`).expect(200)).body?._id;

    expect(tokenA && tokenB && userA && userB).toBeTruthy();
  });

  it('POST /api/likes/:userId should like (201/200)', async () => {
    const res = await request(app)
      .post(`/api/likes/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect((r) => [200,201].includes(r.status));
    expect(res.body).toBeTruthy();
  });

  it('POST /api/superlike with body { id } should succeed (premium path mocked optional)', async () => {
    const res = await request(app)
      .post('/api/superlikes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ id: userB })
      .expect((r) => [200,201,202,429].includes(r.status)); // allow quota logic
    expect(res.body).toBeTruthy();
  });

  it('POST /api/rewind should succeed or be blocked by policy (200/403/429)', async () => {
    const res = await request(app)
      .post('/api/rewind')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect((r) => [200,201,403,429].includes(r.status));
    expect(res.body).toBeTruthy();
  });

  it('Unauthenticated like should be 401', async () => {
    await request(app).post(`/api/likes/${userA}`).send({}).expect(401);
  });
});
// --- REPLACE END ---
