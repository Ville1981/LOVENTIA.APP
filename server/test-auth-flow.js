// --- REPLACE START: Full automated auth flow test using global fetch (Node 18+) ---
/**
 * E2E auth flow smoke test:
 * 1) /health
 * 2) /api/auth/register (unique email+username)
 * 3) /api/auth/login      (captures refresh cookie)
 * 4) /api/auth/refresh    (gets new access token)
 * 5) /api/users/me        (with Bearer token)
 * 6) /api/auth/logout     (clears refresh cookie)
 *
 * Run: node server/test-auth-flow.js
 */
const BASE = process.env.BASE_URL?.replace(/\/+$/, '') || 'http://localhost:5000';
const API  = `${BASE}/api`;

function uniq(prefix='user') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
}

async function main() {
  console.log(`â–¶ Using BASE=${BASE}`);

  // 1) health
  console.log('\n1ï¸âƒ£  /health');
  let res = await fetch(`${BASE}/health`);
  let body = await res.text();
  console.log('Status:', res.status, body);

  // Prepare test identity
  const email    = `${uniq('test')}@example.com`;
  const password = process.env.E2E_TEST_PASSWORD ?? 'Test-' + Date.now();
  const name     = 'TestikÃ¤yttÃ¤jÃ¤';
  const username = uniq('testuser');

  // 2) register
  console.log('\n2ï¸âƒ£  POST /api/auth/register');
  res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, username }),
  });
  body = await res.text();
  console.log('Status:', res.status, body);
  if (res.status >= 400) {
    console.error('âŒ Register failed â€“ stopping.');
    return;
  }

  // 3) login
  console.log('\n3ï¸âƒ£  POST /api/auth/login');
  res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  let json = await res.json().catch(() => ({}));
  console.log('Status:', res.status, json);
  if (res.status >= 400) {
    console.error('âŒ Login failed â€“ stopping.');
    return;
  }
  const bearer = json?.accessToken ? `Bearer ${json.accessToken}` : '';
  const refreshCookie = (setCookie.match(/(^|,)\s*refreshToken=[^;]+/i) || [])[0]?.trim() || '';

  if (!refreshCookie) console.warn('âš ï¸ No refreshToken cookie captured from login.');

  // 4) refresh
  console.log('\n4ï¸âƒ£  POST /api/auth/refresh');
  res  = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: refreshCookie ? { cookie: refreshCookie } : {},
  });
  json = await res.json().catch(() => ({}));
  console.log('Status:', res.status, json);
  if (res.status >= 400) {
    console.error('âŒ Refresh failed â€“ stopping.');
    return;
  }
  const accessToken = json?.accessToken || (bearer.replace(/^Bearer\s+/, '') || '');
  const authHeader  = accessToken ? `Bearer ${accessToken}` : bearer;

  // 5) me
  console.log('\n5ï¸âƒ£  GET /api/users/me');
  res  = await fetch(`${API}/users/me`, { headers: authHeader ? { Authorization: authHeader } : {} });
  body = await res.text();
  console.log('Status:', res.status, body);

  // 6) logout
  console.log('\n6ï¸âƒ£  POST /api/auth/logout');
  res = await fetch(`${API}/auth/logout`, {
    method: 'POST',
    headers: refreshCookie ? { cookie: refreshCookie } : {},
  });
  console.log('Status:', res.status);
  console.log('\nðŸŽ‰ Done.');
}

main().catch((e) => {
  console.error('âŒ Test script error:', e);
  process.exit(1);
});
// --- REPLACE END ---


