// @ts-nocheck
// File: client/performance/load.test.js
// K6 script for page load and API response time under load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Base URLs (from environment or defaults)
// --- REPLACE START: derive base URLs from env or fallbacks ---
const API_URL = __ENV.API_URL || 'http://localhost:3000/api';
const APP_URL = __ENV.APP_URL || API_URL.replace('/api', '');
// --- REPLACE END ---

export let options = {
  stages: [
    { duration: '30s', target: 50 },  // ramp up to 50 virtual users
    { duration: '1m', target: 50 },   // sustain load
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    'page_load_time': ['p(95)<500'],   // 95% of page loads under 500ms
    'api_response_time': ['p(95)<300'],
  },
};

const pageLoadTrend = new Trend('page_load_time');
const apiRespTrend  = new Trend('api_response_time');

export default function () {
  // Page load test
  const pageRes = http.get(`${APP_URL}/messages`);
  check(pageRes, {
    'page status is 200': (r) => r.status === 200,
  });
  pageLoadTrend.add(pageRes.timings.duration);

  // API overview test
  const apiRes = http.get(`${API_URL}/messages/overview`);
  check(apiRes, {
    'api status is 200': (r) => r.status === 200,
  });
  apiRespTrend.add(apiRes.timings.duration);

  sleep(1);
}
