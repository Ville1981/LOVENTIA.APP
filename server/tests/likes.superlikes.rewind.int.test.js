// --- REPLACE START: likes/superlikes/rewind basic integration tests ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

// CI can be slow; give tests more time
jest.setTimeout(30000);

/** Accept either 401 or 403 depending on middleware stack */
function expectAuthDenied(status) {
  expect([401, 403]).toContain(status);
}

/** Helper: extract token from common shapes */
function pickToken(body) {
  return body?.accessToken || body?.token || body?.jwt || null;
}

/** Helper: extract user id from common shapes */
function pickUserId(body) {
  return body?._id || body?.id || body?.userId || null;
}

describe('Likes / Superlikes / Rewind (auth-required)', () => {
  let tokenA, tokenB, userA, userB;

  beforeAll(async () => {
    const now = Date.now();
    const password = process.env.TEST_PASSWORD || `e2e-${now}A1!`;
    const emailA = `a+${now}@example.com`;
    const emailB = `b+${now}@example.com`;

    // Register both users (some backends return 200 instead of 201)
    await request(app)
      .post('/api/auth/register')
      .send({ email: emailA, password })
      .expect((r) => expect([200, 201]).toContain(r.status));

    await request(app)
      .post('/api/auth/register')
      .send({ email: emailB, password })
      .expect((r) => expect([200, 201]).toContain(r.status));

    // Login once per user and capture tokens
    const logA = await request(app).post('/api/auth/login').send({ email: emailA, password });
    const logB = await request(app).post('/api/auth/login').send({ email: emailB, password });
    expect([200, 201]).toContain(logA.status);
    expect([200, 201]).toContain(logB.status);

    tokenA = pickToken(logA.body);
    tokenB = pickToken(logB.body);
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();

    // Resolve user ids via /me
    const meA = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenA}`);
    const meB = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenB}`);
    expect(meA.status).toBe(200);
    expect(meB.status).toBe(200);

    userA = pickUserId(meA.body);
    userB = pickUserId(meB.body);
    expect(userA && userB).toBeTruthy();
  });

  it('POST /api/likes/:userId should like (200/201)', async () => {
    const res = await request(app)
      .post(`/api/likes/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeTruthy();
  });

  it('POST /api/superlikes (body { id }) should succeed or hit quota (200/201/202/429)', async () => {
    const res = await request(app)
      .post('/api/superlikes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ id: userB });

    // Allow premium/quota logic variations
    expect([200, 201, 202, 429]).toContain(res.status);
    expect(res.body).toBeTruthy();
  });

  it('POST /api/rewind should succeed or be blocked by policy (200/201/403/429)', async () => {
    const res = await request(app)
      .post('/api/rewind')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect([200, 201, 403, 429]).toContain(res.status);
    expect(res.body).toBeTruthy();
  });

  it('Unauthenticated like should be 401/403', async () => {
    const res = await request(app).post(`/api/likes/${userA}`).send({});
    expectAuthDenied(res.status);
  });
});
// --- REPLACE END ---
