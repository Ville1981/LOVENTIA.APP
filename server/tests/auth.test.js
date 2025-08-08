// --- REPLACE START: Full auth flow test (login → refresh → logout) ---
const request = require('supertest');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const app = require('../src/app.js');
const User = require('../src/models/User.js');

dotenv.config();

const email = 'testuser@example.com';
const plainPassword = 'TestPass123';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Reset test user
  await User.deleteOne({ email });
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  await User.create({
    email,
    password: hashedPassword,
    name: 'Test User',
    role: 'user',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Auth Flow', () => {
  let accessToken;
  let cookie;

  test('Login returns access token and refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: plainPassword })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();

    accessToken = res.body.accessToken;
    cookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
  });

  test('Refresh token returns new access token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.accessToken).not.toEqual(accessToken);

    accessToken = res.body.accessToken;
  });

  test('Logout clears refresh token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    const clearedCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken='));
    expect(clearedCookie).toMatch(/refreshToken=;/);
  });

  test('Protected route fails with old access token after logout', async () => {
    await request(app)
      .get('/api/users') // or any protected route
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
// --- REPLACE END ---
