// client/performance/load.test.js
// K6‑skripti sovelluksen sivulataus‑ ja viestihakuvasteajan kuormitustestiin
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export let options = {
  stages: [
    { duration: '30s', target: 50 },  // nousu 0→50 virtuaalikäyttäjää
    { duration: '1m', target: 50 },   // vakio 50 käyttäjää
    { duration: '30s', target: 0 },   // lasku 50→0
  ],
  thresholds: {
    'page_load_time': ['p(95)<500'],  // 95% alle 500ms
    'api_response_time': ['p(95)<300'],
  }
};

const pageLoadTrend = new Trend('page_load_time');
const apiRespTrend  = new Trend('api_response_time');

export default function () {
  // Testaa sivun lataus
  let pageRes = http.get('http://localhost:3000/messages');
  check(pageRes, {
    'status ok': (r) => r.status === 200,
  });
  pageLoadTrend.add(pageRes.timings.duration);

  // Simuloi REST API -viestihaku
  let apiRes = http.get('http://localhost:3000/api/messages/overview');
  check(apiRes, {
    'overview ok': (r) => r.status === 200,
  });
  apiRespTrend.add(apiRes.timings.duration);

  sleep(1);
}
