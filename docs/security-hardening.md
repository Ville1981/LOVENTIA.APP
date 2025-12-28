````md
<!--
Path: docs/security-hardening.md

NOTE:
Keep this doc practical and environment-driven.
Avoid claims that require code verification unless explicitly confirmed in the repo.
-->

<!-- // --- REPLACE START: Security hardening doc cleanup (English, consistent structure, clean code fences, ASCII-safe) --- -->

# Security Hardening Plan

This document summarizes how we want to configure **Helmet**, **CORS**, and **rate limits** for Loventia in a consistent way across environments.

## Goals

- Keep **development** fast and convenient.
- Keep **production** locked down by default.
- Avoid "hidden behavior" by making changes explicit and **env-driven**.
- Keep docs aligned with actual middleware order and route grouping.

---

## 0) Canonical ops/docs links

- **Ops Runbook:** [`./ops/runbook.md`](./ops/runbook.md)
- **Rollback Playbook:** [`./ops/rollback-playbook.md`](./ops/rollback-playbook.md)
- **Test Plan:** [`./test-plan.md`](./test-plan.md)
- **CI/CD:** [`./ci-cd.md`](./ci-cd.md)

---

## 1) Helmet (HTTP security headers)

### 1.1 Current status (verify in code)

We typically mount Helmet near the top of the Express app (before routes).

Verify in repo:

- The app uses `helmet()` in the main server entry (`server/src/app.js` or equivalent).
- Any custom header helper (if present) does not conflict with Helmet.

> Keep this section factual: if you change Helmet config in code, update this doc in the same PR.

### 1.2 Target state (production)

In production (behind HTTPS), enable Helmet and keep settings explicit:

- `frameguard: { action: 'deny' }`
- `referrerPolicy: { policy: 'no-referrer' }`
- `xContentTypeOptions: true` (`nosniff`)

**HSTS (Strict-Transport-Security)**

- Send HSTS **only** over HTTPS responses.
- Enable only when `NODE_ENV=production`.
- Recommended defaults:
  - `maxAge`: 15552000 (180 days) to 31536000 (365 days)
  - `includeSubDomains`: `false` (unless we control all subdomains)
  - `preload`: `false` (unless we are ready to commit to preload requirements)

Action items:

- [ ] Confirm Helmet middleware location (should run before routes).
- [ ] Confirm HSTS is only added for HTTPS traffic in production.
- [ ] Document any non-default Helmet config we rely on.

---

## 2) CORS profiles

We want two clear CORS modes: development and production.

### 2.1 Development CORS

- Allowed origins (examples):
  - `http://localhost:5174`
  - `http://127.0.0.1:5174`
- Credentials: `true` (cookies / refresh token flows)
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Allowed headers: `Content-Type, Authorization, X-Requested-With`

Suggested env variables:

```ini
CORS_DEV_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
CORS_ALLOW_CREDENTIALS=true
```
### 2.2 Production CORS

* Allowed origins (examples):

  * `https://loventia.app`
  * `https://www.loventia.app` (only if we actually serve from www)
* Credentials: `true`
* No wildcard `*` in production

Suggested env variables:

```ini
CORS_PROD_ORIGINS=https://loventia.app,https://www.loventia.app
CORS_ALLOW_CREDENTIALS=true
```

Action items:

* [ ] Centralize CORS origin parsing in one place (app bootstrap).
* [ ] In production, log a clear error/warning if no allowed origins are configured.
* [ ] Keep CORS aligned with the client base URL(s) and any CloudFront domain used for staging.

---

## 3) Rate limits (by scope)

We should apply rate limits by route group, then keep a soft catch-all burst limiter for unexpected abuse.

> Business quotas (likes/superlikes/rewinds) remain the primary gate for social actions.
> Rate limits here are a secondary abuse guard.

### 3.1 Auth limits

* Login (`/api/auth/login`, legacy `/api/users/login`)

  * Very strict (example: 5-10 attempts per IP per 15 minutes)
  * Goal: reduce brute-force and password spraying

* Register (if present)

  * Low rate (example: 3 per IP per hour)
  * Goal: deter automated registrations

* Refresh (`/api/auth/refresh`)

  * Moderate rate (example: 60 per minute per IP)
  * Goal: tolerate normal token refresh behavior while blocking loops/abuse

### 3.2 Billing limits

* Checkout/Portal (`/api/billing/*`)

  * Low rate (example: 10 per minute per IP and/or per user)
  * Goal: prevent repeated session creation and abuse

* Mock billing (`/api/payment/mock/*` or similar)

  * Enabled only when `STRIPE_MOCK_MODE=1`

### 3.3 Messages and social actions

* Messages (`/api/messages/*`)

  * Reasonable per-user limit (example: 30-120 per minute, tune later)
  * Goal: deter spam

* Likes / Superlikes / Rewind

  * Primary gating via entitlements/quotas
  * Secondary rate limiter only for extreme bursts

### 3.4 Global API burst limiter

* A soft global limiter (catch-all) to guard against abusive clients.
* Keep it high enough not to break normal browsing.

Action items:

* [ ] Document the actual limiter names and numeric settings in `server/src/middleware/rateLimit.js` (or equivalent).
* [ ] Ensure mount order: per-scope limiters first, then global burst limiter.
* [ ] Ensure limiters are mounted before heavy handlers (uploads, expensive DB queries).

---

## 4) CSP and metrics/admin access (alignment notes)

This section documents intended behavior so we avoid accidental exposure.

### 4.1 Content Security Policy (CSP)

* Prefer starting in Report-Only mode.
* Move to enforce mode only after we confirm reports are clean.

Suggested env flags (example):

```ini
CSP_REPORT_ONLY=true
CSP_ENFORCE=false
```

> If CSP is implemented via a custom middleware, keep the policy in one canonical config and document it here.

### 4.2 Metrics endpoints

* `/metrics` (root)

  * Keep low-risk; do not expose secrets or user data

* `/api/metrics`, `/api/metrics/json`

  * Dev: may be open
  * Prod: require JWT + admin role guard

### 4.3 Admin routes

* `/api/admin/*`

  * Always require authentication + admin role guard
  * Never rely on "security by obscurity"

---

## 5) Next steps

1. Keep this document updated whenever we change Helmet/CORS/rate-limit behavior.
2. Optionally add a short "Security Hardening" link section in `README.md` pointing here.
3. After settings stabilize, add a small PowerShell smoke test that validates:

   * CORS headers for an `OPTIONS` request
   * a known rate-limited endpoint returning `429` after repeated calls (dev-only)

<!-- // --- REPLACE END: Security hardening doc cleanup (English, consistent structure, clean code fences, ASCII-safe) --- -->
```
---


