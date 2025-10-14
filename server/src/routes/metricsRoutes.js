// --- REPLACE START: unified metrics router with counters, latency & inflight gauges ---
// This file consolidates earlier partial patches into one coherent router.
// - No duplicate imports/exports
// - Text (Prometheus-like) + JSON endpoints
// - Global lightweight middleware: metricsRequestCounter
// - Per-route counters, 5xx errors, latency (sum/count + coarse buckets), inflight gauges

import express from 'express';
import os from 'node:os';
import mongoose from 'mongoose';

const router = express.Router();
const STARTED_AT_MS = Date.now();

/* ────────────────────────────────────────────────────────────────────────────
 * Global counters
 * ────────────────────────────────────────────────────────────────────────────
 */
let httpRequestsTotal = 0;
let httpRequestsErrorsTotal = 0;
let httpRequestsInflight = 0;

// Per-route aggregates
// key = "METHOD /path/pattern"
const routeCounters = new Map(); // total count
const routeErrors = new Map();   // 5xx count
const routeLatency = new Map();  // { sumMs, count, buckets: { lt100, lt300, lt1000, gt1000 } }
const routeInflight = new Map(); // inflight per route

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────────
 */
// Create a stable, low-cardinality route label from the matched route or URL
function routeLabelFromUrl(req) {
  const url = (req.originalUrl || req.url || '/').split('?')[0];
  const parts = url
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (/^[0-9a-fA-F]{24}$/.test(seg)) return ':id';   // likely Mongo ObjectId
      if (/^\d+$/.test(seg)) return ':num';              // numeric segment
      if (/^[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(seg)) return ':email';
      return seg.length > 40 ? ':val' : seg;             // cap long arbitrary values
    });
  return `/${parts.join('/')}`;
}

function getRouteKey(req) {
  // Prefer Express-matched pattern when available (e.g. '/api/messages/:userId')
  let pattern = '';
  try {
    if (req.route?.path) {
      if (typeof req.route.path === 'string') pattern = req.route.path;
      else if (Array.isArray(req.route.path)) pattern = req.route.path[0] || '';
    } else if (Array.isArray(req?.app?._router?.stack)) {
      // Fallback: try to extract a mount path from the layer if present
      // (best-effort; avoid heavy inspection to keep overhead minimal)
      pattern = '';
    }
  } catch {
    // ignore
  }
  const base = pattern || routeLabelFromUrl(req);
  return `${req.method} ${base}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public middleware: metricsRequestCounter
 * Mount once near the top of app.js (AFTER request-id if you have one).
 * ────────────────────────────────────────────────────────────────────────────
 */
export function metricsRequestCounter(req, res, next) {
  httpRequestsTotal += 1;
  httpRequestsInflight += 1;

  // optimistic early label; final route pattern may refine on 'finish'
  const earlyKey = getRouteKey(req);
  routeInflight.set(earlyKey, (routeInflight.get(earlyKey) || 0) + 1);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    httpRequestsInflight = Math.max(0, httpRequestsInflight - 1);
    const key = getRouteKey(req);

    // adjust inflight per route (decrement for both early and final labels)
    routeInflight.set(key, Math.max(0, (routeInflight.get(key) || 0) - 1));
    if (key !== earlyKey) {
      routeInflight.set(earlyKey, Math.max(0, (routeInflight.get(earlyKey) || 0) - 1));
    }

    // errors
    if (res.statusCode >= 500) {
      httpRequestsErrorsTotal += 1;
      routeErrors.set(key, (routeErrors.get(key) || 0) + 1);
    }

    // totals
    routeCounters.set(key, (routeCounters.get(key) || 0) + 1);

    // latency
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    const L = routeLatency.get(key) || {
      sumMs: 0,
      count: 0,
      buckets: { lt100: 0, lt300: 0, lt1000: 0, gt1000: 0 },
    };
    L.sumMs += ms;
    L.count += 1;
    if (ms < 100) L.buckets.lt100 += 1;
    else if (ms < 300) L.buckets.lt300 += 1;
    else if (ms < 1000) L.buckets.lt1000 += 1;
    else L.buckets.gt1000 += 1;
    routeLatency.set(key, L);
  });

  // best-effort informative header
  try {
    res.setHeader('X-Req-Counter', String(httpRequestsTotal));
  } catch {
    // ignore header errors
  }

  next();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Metrics collection formatters
 * ────────────────────────────────────────────────────────────────────────────
 */
function collectBase() {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - STARTED_AT_MS) / 1000);
  const mongoUp = mongoose.connection?.readyState === 1 ? 1 : 0;

  return {
    ts: new Date(now).toISOString(),
    service: 'loventia-server',
    node: os.hostname(),
    env: process.env.NODE_ENV || 'development',
    uptimeSeconds,
    mongoUp,
    totals: {
      httpRequestsTotal,
      httpRequestsErrorsTotal,
      httpRequestsInflight,
    },
  };
}

function toTextFormat() {
  const base = collectBase();
  const lines = [];

  // Base gauges/counters
  lines.push('# HELP app_info Application info.');
  lines.push('# TYPE app_info gauge');
  lines.push(`app_info{service="${base.service}",node="${base.node}",env="${base.env}"} 1`);

  lines.push('# HELP process_uptime_seconds Process uptime in seconds.');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${base.uptimeSeconds}`);

  lines.push('# HELP mongo_up Mongo connection health (1=up,0=down).');
  lines.push('# TYPE mongo_up gauge');
  lines.push(`mongo_up ${base.mongoUp}`);

  lines.push('# HELP http_requests_inflight Inflight HTTP requests.');
  lines.push('# TYPE http_requests_inflight gauge');
  lines.push(`http_requests_inflight ${base.totals.httpRequestsInflight}`);

  lines.push('# HELP http_requests_total Total HTTP requests since start.');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${base.totals.httpRequestsTotal}`);

  lines.push('# HELP http_requests_errors_total Total HTTP 5xx responses since start.');
  lines.push('# TYPE http_requests_errors_total counter');
  lines.push(`http_requests_errors_total ${base.totals.httpRequestsErrorsTotal}`);

  // Per-route totals
  lines.push('# HELP http_requests_route_total Total HTTP requests per route.');
  lines.push('# TYPE http_requests_route_total counter');
  for (const [key, count] of routeCounters.entries()) {
    lines.push(`http_requests_route_total{route="${key.replace(/"/g, '\\"')}"} ${count}`);
  }

  // Per-route 5xx
  lines.push('# HELP http_requests_route_errors_total HTTP 5xx per route.');
  lines.push('# TYPE http_requests_route_errors_total counter');
  for (const [key, count] of routeErrors.entries()) {
    lines.push(`http_requests_route_errors_total{route="${key.replace(/"/g, '\\"')}"} ${count}`);
  }

  // Per-route inflight
  lines.push('# HELP http_requests_route_inflight Inflight HTTP requests per route.');
  lines.push('# TYPE http_requests_route_inflight gauge');
  for (const [key, val] of routeInflight.entries()) {
    lines.push(`http_requests_route_inflight{route="${key.replace(/"/g, '\\"')}"} ${val}`);
  }

  // Latency summary (count/sum) + bucket comments (human friendly)
  lines.push('# HELP http_request_duration_ms Route latency summary (ms).');
  lines.push('# TYPE http_request_duration_ms summary');
  for (const [key, L] of routeLatency.entries()) {
    const label = `route="${key.replace(/"/g, '\\"')}"`;
    const sum = L.sumMs.toFixed(2);
    const avg = L.count ? (L.sumMs / L.count).toFixed(2) : '0.00';
    lines.push(`http_request_duration_ms_count{${label}} ${L.count}`);
    lines.push(`http_request_duration_ms_sum{${label}} ${sum}`);
    // Buckets as comments to avoid excessive time-series cardinality
    lines.push(
      `# buckets route="${key}" lt100=${L.buckets.lt100} lt300=${L.buckets.lt300} lt1000=${L.buckets.lt1000} gt1000=${L.buckets.gt1000} avgMs=${avg}`
    );
  }

  // Timestamp (comment)
  lines.push(`# ts ${base.ts}`);

  return lines.join('\n') + '\n';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Routes
 * ────────────────────────────────────────────────────────────────────────────
 */
router.get('/metrics', (req, res) => {
  try {
    const body = toTextFormat();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.status(200).send(body);
  } catch {
    return res.status(500).send('metrics_unavailable\n');
  }
});

router.get('/metrics/json', (_req, res) => {
  try {
    // Expand maps to plain objects for JSON output
    const base = collectBase();

    const counters = {};
    for (const [k, v] of routeCounters.entries()) counters[k] = v;

    const errors = {};
    for (const [k, v] of routeErrors.entries()) errors[k] = v;

    const inflight = {};
    for (const [k, v] of routeInflight.entries()) inflight[k] = v;

    const latency = {};
    for (const [k, L] of routeLatency.entries()) {
      latency[k] = {
        sumMs: Number(L.sumMs.toFixed(2)),
        count: L.count,
        avgMs: L.count ? Number((L.sumMs / L.count).toFixed(2)) : 0,
        buckets: { ...L.buckets },
      };
    }

    return res.status(200).json({
      ...base,
      perRoute: { counters, errors, inflight, latency },
    });
  } catch (e) {
    return res.status(500).json({ error: 'metrics_unavailable' });
  }
});

export default router;
// --- REPLACE END ---
