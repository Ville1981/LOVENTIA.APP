# PATH: server/README.md

````markdown
# Pure ESM refactor — ready

- All new backend files use **ESM** (`import` / `export`) only.
- `server/package.json` has `"type": "module"` so Node runs files as ESM.
- Scripts are wired to run `server.js`.

## Run

```bash
npm run server
# or:
npm start
```

The server will start at:

* API base: **http://localhost:5000/api**
* Health check: **http://localhost:5000/health**

---

## Notes

* If any legacy routes are **CommonJS** (`module.exports = ...`), Node ESM will still import their **default export**.
* Keep Stripe **raw-body** handlers in `src/webhooks/stripe.js` (they must run **before** `express.json()`).
* Put security middleware (helmet / xss / rateLimit / mongoSanitize / hpp / compression) into `src/middleware/security.js`.
* Mount API routers in `src/app.js` only once per base path to avoid duplicate endpoints.

---

<!--
  The replacement region is marked so we can see exactly what was added
  in this “auth-dual-endpoint” session.
-->

// --- REPLACE START

## Auth endpoints (dual entry – intentional)

This project currently exposes **two** login entry points. This is **intentional** and must be documented so it is not “cleaned up” later by accident.

1. **Primary login (new / preferred)**

   * **Method:** `POST`
   * **Path:** `/api/auth/login`
   * **Use for:** React frontend, mobile, integrations
   * **Reason:** lives in the dedicated auth router (`server/src/routes/auth.js`), has the most recent logic (premium flags, entitlements, refresh tokens)

2. **Secondary login (legacy / fallback)**

   * **Method:** `POST`
   * **Path:** `/api/users/login`
   * **Use for:** existing/old clients that were wired straight to the users router
   * **Reason:** older versions of the app (and some PS diagnostics) still call `/api/users/...` – we keep this path alive so old clients do not break right away.

3. **Frontend behaviour (AuthContext)**

   * Tries **first**: `POST /api/auth/login`
   * If that fails with **404** or **405** (router not mounted / method not allowed), it tries → **`POST /api/users/login`**
   * This is exactly what we just tested in PowerShell.

4. **“Me” endpoints – 3 faces, same user**

   * `GET /api/auth/me` → auth router version (full user, entitlements)
   * `GET /api/me` → central “current user” endpoint (normalized shape for FE)
   * `GET /api/users/me` → users router version (compact, used by older views)

   All three now return **consistent** premium flags:

   * `premium: true`
   * `isPremium: true`
   * `entitlements: { ... }`

5. **Why keep both?**

   * We have **live clients** / scripts / test suites that still call `/api/users/login`.
   * We have **new FE** that already uses `/api/auth/login`.
   * Removing one without notice would break either old clients or the new FE.
   * Therefore this dual setup is **by design** and should stay until all consumers are migrated.

6. **What to write to other developers (short):**

   > “Use `POST /api/auth/login` as the primary auth endpoint.
   > Legacy clients may still use `POST /api/users/login`.
   > Do **not** remove `/api/users/login` until all legacy consumers are migrated.”

---

## OpenAPI / Swagger

* OpenAPI spec lives at: `server/openapi/openapi.yaml`

* Expose Swagger UI at: `GET /api/docs` (dev + staging OK, prod optional)

* **Document both** login endpoints in the spec:

  ```text
  POST /api/auth/login     # primary
  POST /api/users/login    # legacy / fallback
  ```

* Also document these (PS-verified):

  * `GET /api/auth/me`
  * `GET /api/me`
  * `GET /api/users/me`
  * `DELETE /api/users/{id}/photos/{slot}`
  * `DELETE /api/users/{id}/photos?path=...`
  * `PUT /api/users/{id}/photos/reorder`
  * `POST /api/users/{id}/set-avatar`

This way the next person sees **why** there are two logins and **why** photo endpoints exist on the users router.

// --- REPLACE END

---

## Security profiles (helmet, CORS, rate-limit)

**Mount order in `src/app.js` (important):**

1. **Stripe raw webhook** (`/webhooks/stripe`) with `express.raw({ type: 'application/json' })`
2. **Security middleware** bundle → `src/middleware/security.js` (helmet → CORS → light XSS → compression)
3. **Parsers** / other middlewares
4. **Rate limits** (`src/middleware/rateLimit.js`) – generic `/api` burst + per-scope for auth/billing/messages
5. **Routers** under `/api/*`
6. 404 + error handler

**Where things live:**

* `src/middleware/security.js` → helmet config, centralized CORS (delegates to `src/config/cors.js`), light XSS guard, compression
* `src/config/cors.js` → env-driven allowlist: `CLIENT_URL`, `STAGE_CLIENT_URL`, `PROD_CLIENT_URL`, `CORS_EXTRA_ORIGINS`, alias `CORS_ORIGINS`
* `src/middleware/rateLimit.js` → fixed-window in-memory limiters (no deps). Env keys:

  * `RATE_DISABLE` (set `1` in CI/tests)
  * `RATE_WINDOW_MS` (default 60000)
  * `RATE_API_BURST_LIMIT`, `RATE_AUTH_LIMIT`, `RATE_AUTH_LOGIN_LIMIT`, `RATE_AUTH_REGISTER_LIMIT`, `RATE_BILLING_LIMIT`, `RATE_MESSAGES_LIMIT`

**Environments:**

* **DEV**: permissive; regex allows any `localhost`/`127.*` if not explicitly listed.
* **STAGE/PROD**: only explicit allowlist; blocked origins return **403 JSON** on preflight and requests.
* **Docs:** `ENABLE_API_DOCS=true` shows `/api/docs` and `/docs`; keep **off** in production unless needed.

**Headers you should see (examples):**

* `X-Content-Type-Options: nosniff`
* `Referrer-Policy: strict-origin-when-cross-origin`
* (Prod) CSP & HSTS according to `security.js` profile
* `Access-Control-Allow-*` present on CORS preflight (allowed origins)

---

## New devs — quick start

> Fastest path to log in, refresh, and fetch **/me** in dev.

### Base URLs

* Local root (health): `http://localhost:5000`
* Local API base: `http://localhost:5000/api`

### Auth endpoints (primary + fallback)

| Purpose            | Method | Path                | Notes                                               |
| ------------------ | ------ | ------------------- | --------------------------------------------------- |
| Login (primary)    | POST   | `/api/auth/login`   | Preferred login route                               |
| Login (fallback)   | POST   | `/api/users/login`  | Only if primary is not mounted                      |
| Refresh token      | POST   | `/api/auth/refresh` | Send refresh token in JSON body                     |
| Logout (stateless) | POST   | `/api/auth/logout`  | Acknowledges logout; token still valid until expiry |

**Request body (login):**

```json
{ "email": "villehermaala1981@gmail.com", "password": "Paavali1981" }
```

### “/me” variants (same normalized shape)

| Method | Path            | Router  | Notes                  |
| ------ | --------------- | ------- | ---------------------- |
| GET    | `/api/auth/me`  | auth    | Primary self route     |
| GET    | `/api/users/me` | users   | Legacy-compatible      |
| GET    | `/api/me`       | central | Centralized self route |

### Common status codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 200  | OK                                      |
| 201  | Created                                 |
| 400  | Bad request / validation failed         |
| 401  | Unauthorized / missing or invalid token |
| 403  | Forbidden                               |
| 404  | Not found                               |
| 415  | Unsupported media type (uploads)        |
| 429  | Rate limited                            |
| 500  | Server error                            |

---

## CORS & Rate-limit smoke (PowerShell + curl)

### CORS preflight — allowed origin → **204**

```powershell
$headers = @{ Origin = "http://localhost:5173"; "Access-Control-Request-Method"="GET" }
Invoke-WebRequest -Method OPTIONS -Uri http://127.0.0.1:5000/api/me -Headers $headers | % StatusCode
# expect: 204
```

### CORS preflight — blocked origin → **403 JSON**

```powershell
$headers = @{ Origin = "https://blocked.example.com"; "Access-Control-Request-Method"="GET" }
try {
  Invoke-WebRequest -Method OPTIONS -Uri http://127.0.0.1:5000/api/me -Headers $headers
} catch {
  $resp  = $_.Exception.Response
  $code  = [int]$resp.StatusCode
  $sr    = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $body  = $sr.ReadToEnd()
  [PSCustomObject]@{ Status = $code; Body = $body }
}
# expect: Status = 403; Body contains {"error":"CORS origin not allowed"}
```

### Quick header peek (helmet)

```bash
curl -I http://127.0.0.1:5000/health
# Check for: X-Content-Type-Options, Referrer-Policy, (CSP/HSTS in prod)
```

### Rate-limit (login hammer → 429)

> Ensure `RATE_DISABLE=0` in your `.env` for this test.

```powershell
$uri = 'http://127.0.0.1:5000/api/auth/login'
$body = @{ email='villehermaala1981@gmail.com'; password='wrong' } | ConvertTo-Json
$results = for ($i=1; $i -le 20; $i++) {
  try {
    Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $body -TimeoutSec 5 | Out-Null
    '200/400'
  } catch {
    [int]$_.Exception.Response.StatusCode
  }
}
$results
# expect to see '429' once threshold is exceeded (limit comes from RATE_AUTH_LOGIN_LIMIT / window)
```

---

<!-- New small addition only; rest of the file unchanged. -->
// --- REPLACE START
## Run security checks locally

Run the same non-blocking checks that CI runs:

```bash
# Security advisory scan (JSON output; never fails the run)
npm run ci:audit

# Dependency hygiene (unused/missing packages; never fails the run)
npm run ci:depcheck
```

Artifacts on CI are stored under `server/security-reports/`. Locally, just read the console output.
// --- REPLACE END

---

## Images — quick references

* Upload (multipart): `POST /api/profile/images`
* List: `GET /api/profile/images`
* Delete: `DELETE /api/profile/images/{imageId}`
* User photo ops:

  * Delete by slot: `DELETE /api/users/{userId}/photos/{slot}`
  * Delete by path: `DELETE /api/users/{userId}/photos?path=/uploads/...`
  * Reorder: `PUT /api/users/{userId}/photos/reorder` (body: `{ "order": [...] }`)
  * Set avatar: `POST /api/users/{userId}/set-avatar` (body: `{ "path": "..." }`)

---

## Billing — quick references

* Checkout session: `POST /api/billing/create-checkout-session`
* Portal session: `POST /api/billing/create-portal-session`
* Sync entitlements: `POST /api/billing/sync`
* Webhook: `POST /webhooks/stripe` (raw body)

---

## Diagnostics

* App routes: `GET /__routes`
* API routes: `GET /__routes_api`
* API routes (detailed): `GET /__routes_api_full`
* Health: `GET /health` (or `/healthz`, `/readiness`)
````

