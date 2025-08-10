// --- REPLACE START: Full automated ESM auth flow test ---
import fetch from 'node-fetch';

const API = 'http://localhost:5000/api/auth';
const TEST_EMAIL = 'testuser@example.com';
const TEST_PASS = 'salasana123';
const TEST_NAME = 'Testikäyttäjä';
const TEST_USERNAME = 'testuser_' + Date.now(); // unique username

let refreshCookie = '';

async function run() {
  console.log('🚀 Starting auth flow test...\n');

  // 1) REGISTER
  console.log('1️⃣ Registering user...');
  let res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASS,
      name: TEST_NAME,
      username: TEST_USERNAME // required by schema
    }),
  });
  let data = await res.json().catch(() => ({}));
  console.log('Status:', res.status, data);
  if (res.status >= 400) return console.error('❌ Register failed, stopping test.\n');

  // 2) LOGIN
  console.log('\n2️⃣ Logging in...');
  res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
  });
  data = await res.json().catch(() => ({}));
  console.log('Status:', res.status, data);
  if (res.status >= 400) return console.error('❌ Login failed, stopping test.\n');

  // Extract refreshToken cookie
  const setCookie = res.headers.raw()['set-cookie'];
  if (setCookie && setCookie.length) {
    refreshCookie = setCookie.find(c => c.startsWith('refreshToken='));
    console.log('✅ Got refreshToken cookie.');
  } else {
    console.warn('⚠️ No refreshToken cookie found.');
  }

  // 3) REFRESH TOKEN
  console.log('\n3️⃣ Refreshing token...');
  res = await fetch(`${API}/refresh`, {
    method: 'POST',
    headers: { Cookie: refreshCookie || '' },
  });
  data = await res.json().catch(() => ({}));
  console.log('Status:', res.status, data);
  if (res.status >= 400) return console.error('❌ Refresh failed, stopping test.\n');

  // 4) LOGOUT
  console.log('\n4️⃣ Logging out...');
  res = await fetch(`${API}/logout`, {
    method: 'POST',
    headers: { Cookie: refreshCookie || '' },
  });
  console.log('Status:', res.status);
  if (res.status === 204) {
    console.log('✅ Logout successful.');
  } else {
    console.warn('⚠️ Logout returned unexpected status.');
  }

  console.log('\n🎯 Auth flow test complete.');
}

run().catch(err => {
  console.error('❌ Test script error:', err);
});
// --- REPLACE END ---
