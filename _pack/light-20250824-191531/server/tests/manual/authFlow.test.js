// File: server/tests/manual/authFlow.test.js
// Run manually with: node server/tests/manual/authFlow.test.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api/auth';
const TEST_USER = {
  email: 'test@example.com', // change to an existing test user
  password: 'password123'
};

let cookieJar = '';

async function login() {
  console.log('--- LOGIN ---');
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  const cookies = res.headers.raw()['set-cookie'];
  if (cookies) {
    cookieJar = cookies.map(c => c.split(';')[0]).join('; ');
  }

  const data = await res.json();
  console.log('Access Token:', data.accessToken ? '[REDACTED]' : null);
  console.log('Cookies:', cookieJar);
}

async function refresh() {
  console.log('--- REFRESH ---');
  const res = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    headers: { Cookie: cookieJar }
  });
  const data = await res.json();
  console.log('New Access Token:', data.accessToken ? '[REDACTED]' : null);
}

async function logout() {
  console.log('--- LOGOUT ---');
  const res = await fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    headers: { Cookie: cookieJar }
  });
  console.log('Logout status:', res.status);
}

(async () => {
  try {
    await login();
    await refresh();
    await logout();
    console.log('Auth flow test completed ✅');
  } catch (err) {
    console.error('Test failed ❌', err);
  }
})();
