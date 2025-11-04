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
````

The server will start at:

* API base: **[http://localhost:5000/api](http://localhost:5000/api)**
* Health check: **[http://localhost:5000/health](http://localhost:5000/health)**

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
   * **Reason:** lives in the dedicated auth router (`server/src/routes/auth.js`), has the most recent logic (premium flags, entitlements, refresh-tokens)

2. **Secondary login (legacy / fallback)**

   * **Method:** `POST`
   * **Path:** `/api/users/login`
   * **Use for:** existing/old clients that were wired straight to the users router
   * **Reason:** older versions of the app (and some PS diagnostics) still call `/api/users/...` – we keep this path alive so old clients do not break right away.

3. **Frontend behaviour (AuthContext)**

   * Tries **first**: `POST /api/auth/login`
   * If that fails with **404** or **405** (router not mounted / method not allowed), it tries
     → **`POST /api/users/login`**
   * This is exactly what we just tested in PowerShell.

4. **Me endpoints – 3 faces, same user**

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

* OpenAPI spec should live at: `server/openapi/openapi.yaml`

* Expose Swagger UI at: `GET /api/docs` (dev + staging ok, prod optional)

* **Must document both** login endpoints in the spec:

  ```text
  POST /api/auth/login     # primary
  POST /api/users/login    # legacy / fallback
  ```

* Also document these, since we verified them with PS:

  * `GET /api/auth/me`
  * `GET /api/me`
  * `GET /api/users/me`
  * `DELETE /api/users/{id}/photos/{slot}`
  * `DELETE /api/users/{id}/photos?path=...`
  * `PUT /api/users/{id}/photos/reorder`
  * `POST /api/users/{id}/set-avatar`

This way the next person sees **why** there are two logins and **why** photo endpoints exist on the users router.

// --- REPLACE END

```
```
