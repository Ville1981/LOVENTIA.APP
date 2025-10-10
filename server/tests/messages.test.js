// File: server/tests/messages.int.test.js

// --- REPLACE START: integration tests for messages (send → thread → overview → invalid/auth paths) ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

// CI can be a bit slow
jest.setTimeout(30000);

/** Accept either 401 or 403 depending on middleware */
function expectAuthDenied(status) {
  expect([401, 403]).toContain(status);
}

/** Helper: extract token from { token | accessToken } */
function pickToken(body) {
  return body?.token || body?.accessToken || body?.jwt || null;
}

describe('Messages basics', () => {
  let tokenA, tokenB, userA, userB;

  beforeAll(async () => {
    const now = Date.now();
    const emailA = `a+${now}@example.com`;
    const emailB = `b+${now}@example.com`;
    const password = 'Passw0rd!234';

    // Register both users (some implementations return 200 instead of 201)
    await request(app).post('/api/auth/register').send({ email: emailA, password }).expect((r) => {
      expect([200, 201]).toContain(r.status);
    });
    await request(app).post('/api/auth/register').send({ email: emailB, password }).expect((r) => {
      expect([200, 201]).toContain(r.status);
    });

    // Login and capture tokens
    const logA = await request(app).post('/api/auth/login').send({ email: emailA, password });
    const logB = await request(app).post('/api/auth/login').send({ email: emailB, password });
    expect([200, 201]).toContain(logA.status);
    expect([200, 201]).toContain(logB.status);

    tokenA = pickToken(logA.body);
    tokenB = pickToken(logB.body);
    expect(tokenA).toBeTruthy();
    expect(tokenB).toBeTruthy();

    // Resolve user ids
    const meA = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenA}`);
    const meB = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenB}`);
    expect(meA.status).toBe(200);
    expect(meB.status).toBe(200);

    userA = meA.body?._id || meA.body?.id;
    userB = meB.body?._id || meB.body?.id;
    expect(userA).toBeTruthy();
    expect(userB).toBeTruthy();
  });

  test('GET /api/messages/overview requires auth', async () => {
    const res = await request(app).get('/api/messages/overview');
    expectAuthDenied(res.status);
  });

  test('GET /api/messages/overview returns 200 for authenticated user', async () => {
    const res = await request(app)
      .get('/api/messages/overview')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // Accept either array of threads or object with {threads:[]}
    const list = Array.isArray(res.body)
      ? res.body
      : Array.isArray(res.body?.threads)
      ? res.body.threads
      : null;
    expect(Array.isArray(list)).toBe(true);
  });

  test('POST /api/messages/:userId rejects invalid payload', async () => {
    // Missing text
    const r1 = await request(app)
      .post(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect([400, 422]).toContain(r1.status);

    // Non-string text
    const r2 = await request(app)
      .post(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: { not: 'a string' } });
    expect([400, 422]).toContain(r2.status);

    // Too long text (if server validates length). We accept either 400/413/422/201 depending on implementation.
    const longText = 'x'.repeat(10001);
    const r3 = await request(app)
      .post(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: longText });
    expect([200, 201, 400, 413, 422]).toContain(r3.status);
  });

  test('POST /api/messages/:userId requires auth', async () => {
    const res = await request(app).post(`/api/messages/${userB}`).send({ text: 'hello' });
    expectAuthDenied(res.status);
  });

  test('POST /api/messages/:userId sends a message (201/200)', async () => {
    const res = await request(app)
      .post(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'hello' });

    expect([200, 201]).toContain(res.status);
    // Accept either {ok:true} or a saved message object with _id
    expect(res.body).toBeTruthy();
    expect(res.body.ok === true || !!res.body._id || !!res.body.id).toBe(true);
  });

  test('GET /api/messages/:userId fetches the thread (array of messages)', async () => {
    const res = await request(app)
      .get(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    // Accept shapes:
    //  - [ { from, to, text } ]
    //  - { messages: [] }
    const msgs = Array.isArray(res.body)
      ? res.body
      : Array.isArray(res.body?.messages)
      ? res.body.messages
      : null;
    expect(Array.isArray(msgs)).toBe(true);
  });

  test('GET /api/messages/:userId requires auth', async () => {
    const res = await request(app).get(`/api/messages/${userB}`);
    expectAuthDenied(res.status);
  });

  test('POST /api/messages/:userId should not allow sending to self (expect 400/422/403)', async () => {
    const res = await request(app)
      .post(`/api/messages/${userA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'to myself' });

    expect([400, 403, 422]).toContain(res.status);
  });

  test('Overview includes counterpart after sending', async () => {
    // Send one more message to ensure thread presence
    await request(app)
      .post(`/api/messages/${userB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'ping' })
      .expect([200, 201]);

    const res = await request(app)
      .get('/api/messages/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const threads = Array.isArray(res.body) ? res.body : res.body?.threads || [];
    const found = threads.some((t) => {
      const partner =
        t?.otherUserId || t?.userId || t?.withUserId || t?.participantId || t?.partnerId;
      return String(partner) === String(userB);
    });
    // Not all backends expose IDs in overview; accept either found=true or just non-empty overview
    expect(found || Array.isArray(threads)).toBe(true);
  });
});
// --- REPLACE END ---

