````markdown
# PATH: docs/security-hardening.md

# Security hardening plan

This document summarizes how we want to configure **helmet**, **CORS** and **rate-limits** for Loventia in a consistent way across environments.

The goal is:
- Keep **dev** fast and convenient.
- Keep **production** locked down by default.
- Avoid “hidden behaviour” by making everything driven by env flags.

---

## 1. Helmet configuration (HTTP security headers)

### 1.1 Current state (dev)

- `helmet()` is already mounted in `server/src/app.js`.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), fullscreen=(self)`
- `Strict-Transport-Security` (HSTS) is **not** sent on plain HTTP (dev).

### 1.2 Target state (prod)

In production (behind HTTPS):

- `helmet()` enabled with:
  - `frameguard: { action: 'deny' }`
  - `referrerPolicy: { policy: 'no-referrer' }`
  - `contentSecurityPolicy` left to our **CSP middleware** (see below).
- HSTS:
  - Enabled **only** if `NODE_ENV=production` **and** `req.secure === true`.
  - `maxAge`: 6–12 months (to be decided).
  - `includeSubDomains`: false (for now).
  - `preload`: false (for now).

**Action items:**

- [ ] Keep helmet as-is in dev.
- [ ] In prod, make sure HSTS is only set for HTTPS traffic (already done in `securityHeaders` helper).
- [ ] Document any future header changes here so they match PS smoketests.

---

## 2. CORS profiles

We want **two clear CORS modes**: dev and prod.

### 2.1 Dev CORS

- Allowed origins:
  - `http://localhost:5174`
  - `http://127.0.0.1:5174`
- Credentials: `true` (cookies for refresh token).
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Allowed headers: `Content-Type, Authorization, X-Requested-With`.

Suggested env variables:

```ini
CORS_DEV_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
CORS_ALLOW_CREDENTIALS=true
````

### 2.2 Prod CORS

* Allowed origins:

  * `https://loventia.app`
  * possibly `https://www.loventia.app` (if we ever use www).
* Credentials: `true`.
* Methods and headers same as dev.
* No wildcard `*` in production.

Suggested env variables:

```ini
CORS_PROD_ORIGINS=https://loventia.app,https://www.loventia.app
```

**Action items:**

* [ ] Centralize CORS logic in `server/src/app.js`:

  * Read `NODE_ENV` and choose dev vs prod origins from env vars.
  * Throw a clear log if no origins are configured in prod.
* [ ] Keep CORS rules in sync with the client’s `VITE_API_BASE_URL`.

---

## 3. Rate-limits per scope

We already have a shared `rateLimit.js` with named limiters. This plan just defines how we want to **use** them consistently.

### 3.1 Auth-related limits

* **Login (`/api/auth/login`, `/api/users/login`)**

  * Scope: `login`
  * Very strict limit (e.g. 5–10 attempts per IP per 15 minutes).
  * Purpose: protect against password spraying and brute force.

* **Register (`/api/users/register` if present)**

  * Scope: `register`
  * Low rate (e.g. 3 per IP per hour) to block abuse.

* **Refresh (`/api/auth/refresh`)**

  * Scope: `auth`
  * Moderate limit (e.g. 60/min per IP), since FE may call this automatically.

### 3.2 Billing limits

* **Stripe checkout & portal (`/api/billing/*`)**

  * Scope: `billing`
  * Very low rate (e.g. 10/min per IP + per user).
  * We only expect a few clicks per user per hour.

* **Mock endpoints (`/api/payment/mock/*`)**

  * Scope: `billingMock`
  * Enabled only if `STRIPE_MOCK_MODE=1`.

### 3.3 Messages & social actions

* **Messages (`/api/messages/*`)**

  * Scope: `messages`
  * Limit to a reasonable number of messages/minute per user to deter spam.

* **Likes / Superlikes / Rewind**

  * Scope: `social`
  * Use business logic (quotas) as the primary gate.
  * Rate-limit only to block extreme abuse (e.g. scripted spam).

### 3.4 Global API burst limit

* **Catch-all** limiter:

  * Scope: `api`
  * A soft global guard for “too many requests”.

**Action items:**

* [ ] Document existing scopes and their numeric settings in `server/src/middleware/rateLimit.js`.
* [ ] Ensure `app.js` mounts the correct limiter per route group:

  * `authRouter` → `loginLimiter` / `authLimiter`.
  * `billingRouter` → `billingLimiter`.
  * `messagesRouter` → `messagesLimiter`.
  * Catch-all → `apiBurstLimiter`.

---

## 4. CSP and metrics/admin access (alignment only)

These are already mostly implemented; this section only records the intended behaviour.

### 4.1 CSP

* Report-Only:

  * Enabled always via `Content-Security-Policy-Report-Only`.
  * Default policy: strict `default-src 'none'` with narrow allowances.
* Enforce:

  * Controlled by `CSP_ENFORCE` and `CSP_ENFORCE_POLICY`.
  * Currently **off** in dev.
  * Will be turned on **only after** we validate the policy with CSP reports.

### 4.2 Metrics & admin

* `/metrics` (root):

  * Always open (liveness/perf probe, no sensitive data).
* `/api/metrics`, `/api/metrics/json`:

  * Dev/test: open.
  * Prod: requires JWT + role `admin|owner|superadmin`.
* `/api/admin/*`:

  * Must always go through `authenticate` + admin role guard.

---

## 5. Next steps

1. Keep this document updated when we tweak helmet/CORS/rate-limits.
2. Optionally, add a short “Security & Hardening” section to `README.md` linking to this file.
3. Once the settings are stable in prod, add a small PowerShell smoketest that:

   * Confirms CORS headers for a sample OPTIONS/GET request.
   * Confirms 429 behaviour for at least one rate-limited route group (e.g. login).

```
```
