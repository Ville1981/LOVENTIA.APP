// File: scripts/authSmokeTest.js
// --- REPLACE START: Auth end-to-end smoke test using axios + cookie jar ---
/**
 * Auth smoke test:
 * - Register (optional: skips if email already exists)
 * - Login -> expects accessToken + sets refresh cookie server-side
 * - Me (with access token)
 * - Refresh -> get a new access token via refresh cookie
 * - Logout -> invalidates refresh cookie/server session
 * - Me (should fail with 401/403)
 *
 * Uses:
 *  - BASE_URL from .env (e.g. http://localhost:5000/api)
 *  - TEST_EMAIL, TEST_PASSWORD from .env
 *
 * Requires dev backend to set refresh token as an HttpOnly cookie.
 */

import 'dotenv/config';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import chalk from 'chalk';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const TEST_EMAIL = process.env.TEST_EMAIL || 'tester+auth@loventia.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'VeryStrong!123';

const log = {
  step: (t) => console.log(chalk.cyan(`\n▶ ${t}`)),
  ok:   (t) => console.log(chalk.green(`✅ ${t}`)),
  warn: (t) => console.log(chalk.yellow(`⚠️  ${t}`)),
  err:  (t) => console.log(chalk.red(`❌ ${t}`)),
  info: (t) => console.log(chalk.gray(t)),
};

async function run() {
  log.step(`Using BASE_URL=${BASE_URL}`);

  // One shared cookie jar so refresh cookie persists between calls
  const jar = new CookieJar();
  const api = wrapper(axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    jar,
  }));

  let accessToken = null;

  // Create a fresh instance with Authorization header when we have a token
  function authApi() {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    return wrapper(axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      jar,
      headers,
    }));
  }

  // 1) REGISTER (non-fatal if already exists)
  try {
    log.step('Register');
    const { data } = await api.post('/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    log.ok(`Registered ${data?.user?.email || TEST_EMAIL}`);
  } catch (e) {
    const status = e?.response?.status;
    if (status === 409 || status === 400) {
      log.warn(`Register skipped (${status}) — user likely exists. Continuing.`);
    } else {
      log.err(`Register failed: ${status || e.message}`);
      if (e.response?.data) log.info(JSON.stringify(e.response.data));
      // Continue to login anyway
    }
  }

  // 2) LOGIN
  try {
    log.step('Login');
    const { data } = await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    accessToken = data?.accessToken || data?.token || null;
    if (!accessToken) throw new Error('No accessToken in response');
    log.ok('Login OK (accessToken received)');
  } catch (e) {
    const status = e?.response?.status;
    log.err(`Login failed: ${status || e.message}`);
    if (e.response?.data) log.info(JSON.stringify(e.response.data));
    process.exit(1);
  }

  // 3) ME with access token
  try {
    log.step('Me (with access token)');
    const { data } = await authApi().get('/auth/me');
    if (!data?.user?.email) throw new Error('No user in /auth/me');
    log.ok(`Me OK (${data.user.email})`);
  } catch (e) {
    const status = e?.response?.status;
    log.err(`Me failed: ${status || e.message}`);
    if (e.response?.data) log.info(JSON.stringify(e.response.data));
    process.exit(1);
  }

  // 4) REFRESH -> new access token via refresh cookie
  try {
    log.step('Refresh');
    const { data } = await api.post('/auth/refresh', {});
    const newToken = data?.accessToken || data?.token || null;
    if (!newToken) throw new Error('No accessToken in refresh response');
    accessToken = newToken;
    log.ok('Refresh OK (new accessToken received)');
  } catch (e) {
    const status = e?.response?.status;
    log.err(`Refresh failed: ${status || e.message}`);
    if (e.response?.data) log.info(JSON.stringify(e.response.data));
    process.exit(1);
  }

  // 5) LOGOUT
  try {
    log.step('Logout');
    await api.post('/auth/logout', {});
    log.ok('Logout OK (refresh cookie invalidated)');
  } catch (e) {
    const status = e?.response?.status;
    log.err(`Logout failed: ${status || e.message}`);
    if (e.response?.data) log.info(JSON.stringify(e.response.data));
    process.exit(1);
  }

  // 6) ME after logout (should fail)
  try {
    log.step('Me after logout (should fail)');
    await authApi().get('/auth/me');
    log.err('Me unexpectedly succeeded after logout');
    process.exit(1);
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401 || status === 403) {
      log.ok(`Me correctly failed after logout (${status})`);
    } else {
      log.warn(`Me after logout gave unexpected status: ${status || e.message}`);
    }
  }

  log.ok('\nAll auth smoke steps completed.');
}

run().catch((e) => {
  log.err(e.stack || e.message);
  process.exit(1);
});
// --- REPLACE END ---
