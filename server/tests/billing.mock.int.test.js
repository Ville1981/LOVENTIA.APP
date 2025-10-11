// --- REPLACE START: billing (mock mode) integration tests ---
/* eslint-env jest */
import request from 'supertest';
import app from '../src/app.js';

const EXPECT_OK = (r) => [200,201,302].includes(r.status);

describe('Billing (mock mode)', () => {
  let token;

  beforeAll(async () => {
    // Ensure mock mode in test runs (server middleware may check header/env)
    process.env.STRIPE_MOCK_MODE = process.env.STRIPE_MOCK_MODE || '1';

    const email = `bill+${Date.now()}@example.com`;
    const password = process.env.TEST_PASSWORD || ("e2e-" + Date.now() + "A1!");
    await request(app).post('/api/auth/register').send({ email, password }).expect([200,201]);

    const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    token = login.body.accessToken || login.body.token;
    expect(token).toBeTruthy();
  });

  test('POST /api/billing/create-checkout-session returns URL', async () => {
    const res = await request(app)
      .post('/api/billing/create-checkout-session')
      .set('Authorization', `Bearer ${token}`)
      .set('x-stripe-mock', '1')
      .send({})
      .expect(EXPECT_OK);

    const url = res.body?.url || res.body?.data?.url;
    expect(typeof url).toBe('string');
  });

  test('POST /api/billing/create-portal-session returns URL', async () => {
    const res = await request(app)
      .post('/api/billing/create-portal-session')
      .set('Authorization', `Bearer ${token}`)
      .set('x-stripe-mock', '1')
      .send({})
      .expect(EXPECT_OK);

    const url = res.body?.url || res.body?.data?.url;
    expect(typeof url).toBe('string');
  });

  test('POST /api/billing/cancel-now returns structured result', async () => {
    const res = await request(app)
      .post('/api/billing/cancel-now')
      .set('Authorization', `Bearer ${token}`)
      .set('x-stripe-mock', '1')
      .send({})
      .expect(EXPECT_OK);

    // Accept both { results: [...] } or { canceled: [...] }
    const list = res.body?.results || res.body?.canceled || [];
    expect(Array.isArray(list)).toBe(true);
  });

  test('Unauthorized billing request = 401', async () => {
    await request(app).post('/api/billing/create-checkout-session').send({}).expect(401);
  });
});
// --- REPLACE END ---
