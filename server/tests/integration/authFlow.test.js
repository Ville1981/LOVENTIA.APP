// File: server/tests/integration/authFlow.test.js
// Run with: npx jest server/tests/integration/authFlow.test.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/auth';
const TEST_USER = {
  email: 'test@example.com', // change to existing test user
  password: 'password123'
};

describe('Auth Flow', () => {
  let cookieJar = '';

  it('should login and receive tokens', async () => {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });

    expect(res.status).toBe(200);
    const cookies = res.headers.raw()['set-cookie'];
    expect(cookies).toBeDefined();

    cookieJar = cookies.map(c => c.split(';')[0]).join('; ');
    const data = await res.json();

    expect(data.accessToken).toBeDefined();
    expect(data.user).toHaveProperty('id');
  });

  it('should refresh access token', async () => {
    const res = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      headers: { Cookie: cookieJar },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.accessToken).toBeDefined();
  });

  it('should logout and clear cookie', async () => {
    const res = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { Cookie: cookieJar },
    });

    expect(res.status).toBe(204);
  });
});
