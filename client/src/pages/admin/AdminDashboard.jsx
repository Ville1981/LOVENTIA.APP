// File: client/src/pages/admin/AdminDashboard.jsx

// --- REPLACE START: minimal Admin KPI dashboard (no extra deps) ---
import React, { useEffect, useMemo, useState } from "react";
import api from "../../utils/axiosInstance";

/**
 * Admin KPI Dashboard
 * - Fetches /api/admin/metrics/summary
 * - Shows top KPIs (users total, DAU/WAU/MAU, messages last 24h, premium count, revenue MTD)
 * - Simple bar list for last 7 days signups/messages (no external chart libs)
 *
 * Requirements:
 * - The current user must be an admin (server protects the route).
 * - Axios instance should include auth bearer automatically (as elsewhere in app).
 */

function StatCard({ title, value, subtitle, testid }) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1" data-testid={testid}>
        {value}
      </div>
      {subtitle ? <div className="text-xs text-gray-400 mt-1">{subtitle}</div> : null}
    </div>
  );
}

function TinyBarList({ title, items, max = 1 }) {
  const maxVal = useMemo(
    () => Math.max(max, ...items.map((i) => i.value || 0)),
    [items, max]
  );
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((it) => {
          const pct = maxVal ? Math.round(((it.value || 0) / maxVal) * 100) : 0;
          return (
            <div key={it.label}>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{it.label}</span>
                <span>{it.value}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded">
                <div
                  className="h-2 bg-blue-600 rounded"
                  style={{ width: `${pct}%` }}
                  aria-label={`${it.label} ${it.value}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/admin/metrics/summary");
        if (!mounted) return;
        setData(res.data || {});
      } catch (e) {
        setErr(e?.response?.data?.error || e?.message || "Failed to load KPIs");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const last7Signups = useMemo(() => data?.series?.signups7d || [], [data]);
  const last7Messages = useMemo(() => data?.series?.messages7d || [], [data]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-3">Admin — KPIs</h1>
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-3">Admin — KPIs</h1>
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3">{err}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-3">Admin — KPIs</h1>
      <p className="text-sm text-gray-600 mb-4">
        High-level metrics for the last 24h/7d/30d. This view uses a lightweight API and no client chart libs.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <StatCard
          title="Users total"
          value={data?.totals?.users ?? "—"}
          subtitle="All time"
          testid="kpi-users-total"
        />
        <StatCard
          title="Premium subscribers"
          value={data?.totals?.premium ?? "—"}
          subtitle="Current"
          testid="kpi-premium-total"
        />
        <StatCard
          title="Revenue MTD"
          value={typeof data?.totals?.revenueMtd === "number" ? `$${data.totals.revenueMtd.toFixed(2)}` : "—"}
          subtitle="From Stripe charges (test data in dev)"
          testid="kpi-revenue-mtd"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard title="DAU (24h)" value={data?.activity?.dau ?? "—"} testid="kpi-dau" />
        <StatCard title="WAU (7d)" value={data?.activity?.wau ?? "—"} testid="kpi-wau" />
        <StatCard title="MAU (30d)" value={data?.activity?.mau ?? "—"} testid="kpi-mau" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TinyBarList title="Signups (last 7 days)" items={last7Signups} />
        <TinyBarList title="Messages sent (last 7 days)" items={last7Messages} />
      </div>
    </div>
  );
}
// --- REPLACE END ---



// File: client/src/pages/admin/AdminDashboard.jsx

// --- REPLACE START: minimal Admin KPI dashboard (axios, data-testids) ---
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../utils/axiosInstance';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

const Row = ({ title, children }) => (
  <div className="border border-gray-200 rounded-lg mb-6">
    <div className="px-4 py-2 font-semibold">{title}</div>
    <div className="px-4 py-3 border-t border-gray-100">{children}</div>
  </div>
);

export default function AdminDashboard() {
  const { user } = useAuth?.() || {};
  const isAdmin = user?.role === 'admin' || user?.isAdmin === true;

  const [since, setSince] = useState(() => {
    const d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return d.toISOString();
  });
  const [metrics, setMetrics] = useState(null);
  const [revStart, setRevStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const [revEnd, setRevEnd] = useState(() => new Date().toISOString());
  const [revenue, setRevenue] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const canView = !!isAdmin;

  const loadMetrics = useCallback(async () => {
    try {
      setBusy(true);
      setMsg('');
      const res = await api.get('/admin/metrics', { params: { since } });
      setMetrics(res.data);
    } catch (e) {
      setMsg(e?.response?.data?.error || 'Failed to load metrics');
    } finally {
      setBusy(false);
    }
  }, [since]);

  const loadRevenue = useCallback(async () => {
    try {
      setBusy(true);
      setMsg('');
      const res = await api.get('/admin/stripe/revenue', { params: { start: revStart, end: revEnd } });
      setRevenue(res.data);
    } catch (e) {
      setMsg(e?.response?.data?.error || 'Failed to load revenue');
    } finally {
      setBusy(false);
    }
  }, [revStart, revEnd]);

  useEffect(() => {
    if (canView) {
      void loadMetrics();
      void loadRevenue();
    }
  }, [canView, loadMetrics, loadRevenue]);

  const prettyDate = useCallback((iso) => {
    try {
      return format(new Date(iso), 'yyyy-MM-dd');
    } catch {
      return iso;
    }
  }, []);

  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-600 mb-6">High-level KPIs & Stripe revenue (test/live depends on your server key).</p>

      {msg && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">{msg}</div>
      )}

      <Row title="Users & Engagement">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="text-sm">
            Since:
            <input
              data-testid="since-input"
              type="date"
              className="ml-2 border rounded px-2 py-1"
              value={prettyDate(since)}
              onChange={(e) => {
                const d = new Date(e.target.value + 'T00:00:00Z').toISOString();
                setSince(d);
              }}
            />
          </label>
          <button
            data-testid="refresh-metrics"
            type="button"
            onClick={loadMetrics}
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
            disabled={busy}
          >
            {busy ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="metrics-cards">
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">Total users</div>
            <div className="text-2xl font-bold">{metrics?.users?.total ?? '—'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">New since {prettyDate(metrics?.since || since)}</div>
            <div className="text-2xl font-bold">{metrics?.users?.new ?? '—'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">Premium users</div>
            <div className="text-2xl font-bold" data-testid="premium-count">{metrics?.users?.premium ?? '—'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">Messages (since)</div>
            <div className="text-2xl font-bold">{metrics?.engagement?.messages ?? '—'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs text-gray-500">Likes (since)</div>
            <div className="text-2xl font-bold">{metrics?.engagement?.likes ?? '—'}</div>
          </div>
        </div>
      </Row>

      <Row title="Stripe Revenue">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="text-sm">
            Start:
            <input
              data-testid="rev-start"
              type="date"
              className="ml-2 border rounded px-2 py-1"
              value={prettyDate(revStart)}
              onChange={(e) => setRevStart(new Date(e.target.value + 'T00:00:00Z').toISOString())}
            />
          </label>
          <label className="text-sm">
            End:
            <input
              data-testid="rev-end"
              type="date"
              className="ml-2 border rounded px-2 py-1"
              value={prettyDate(revEnd)}
              onChange={(e) => setRevEnd(new Date(e.target.value + 'T23:59:59Z').toISOString())}
            />
          </label>
          <button
            data-testid="refresh-revenue"
            type="button"
            onClick={loadRevenue}
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
            disabled={busy}
          >
            {busy ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="flex items-center gap-4 mb-2">
          <div className="text-sm text-gray-600">
            Mode:&nbsp;
            <span className="font-semibold" data-testid="stripe-mode">
              {revenue?.enabled === false ? 'disabled' : (revenue?.mode || 'test')}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Window:&nbsp;
            <span className="font-mono">{prettyDate(revStart)} → {prettyDate(revEnd)}</span>
          </div>
        </div>

        <div className="rounded border p-3 inline-block">
          <div className="text-xs text-gray-500">Revenue total</div>
          <div className="text-3xl font-extrabold" data-testid="revenue-total">
            {revenue?.enabled === false ? '—' : `${(revenue?.total ?? 0) / 100} ${revenue?.currency || 'usd'}`}
          </div>
          <div className="text-xs text-gray-500">Succeeded payments: {revenue?.count ?? 0}</div>
        </div>
      </Row>
    </div>
  );
},
// --- REPLACE END ---
,
,,,,,,




,,:),.