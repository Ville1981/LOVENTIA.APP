# PATH: docs/ci-cd.md

# CI/CD Documentation

This document explains our GitHub Actions workflows, secrets management, and best practices for continuous integration and delivery of the Loventia application.

<!-- // --- REPLACE START: Add Ops docs section (canonical ops links; consistent relative paths) --- -->
## Ops docs (incidents / production operations)

These are the canonical operational docs used during incidents and production work:

- **Ops Runbook (canonical):** [`./ops/runbook.md`](./ops/runbook.md)
- **Rollback Playbook (canonical):** [`./ops/rollback-playbook.md`](./ops/rollback-playbook.md)

> Notes:
> - These links are relative to `docs/` (this file).
> - Keep ops docs canonical under `docs/ops/` to avoid duplicate/conflicting playbooks.
<!-- // --- REPLACE END: Add Ops docs section (canonical ops links; consistent relative paths) --- -->

---

## 1. Workflows Overview

All workflows are located in `.github/workflows/`.  
This section is a **high-level map** – always check the actual YAML file if you need exact commands or triggers.

### 1.1 `openapi-ci.yml`

**Purpose**

- Validate and bundle the OpenAPI specification for the backend API.

**Key responsibilities**

- Run Spectral lint on `server/openapi/openapi.yaml` using `.spectral.yaml`.
- Bundle the spec into a single dereferenced file (e.g. `openapi.bundle.yaml`) using Redocly.
- Upload the bundled spec as a CI artifact so it can be consumed by docs, testing, or tooling.

**Typical triggers**

- `push` / `pull_request` to main branches (e.g. `main`, `dev`, feature branches touching `server/openapi/`).
- Manual trigger via **Actions → openapi-ci → Run workflow**.

**When it fails**

- The OpenAPI spec has lint errors (missing descriptions, invalid refs, schema issues).
- The bundle step cannot resolve references or the spec is syntactically invalid.

When this workflow fails, fix the spec and re-run the workflow before merging.

---

### 1.2 `server-ci.yml`

**Purpose**

- Run continuous integration checks for the **Node.js/Express backend** (`server/`).

**Key responsibilities (high level)**

- Set up Node.js (current LTS in the workflow).
- Install backend dependencies (usually `npm ci` in `server/`).
- Run backend tests (and optionally lint/build) via the configured npm scripts.
- Optionally archive test reports or coverage as artifacts.

> **Note:** See `.github/workflows/server-ci.yml` for the exact Node version, npm scripts, and paths used.

**Typical triggers**

- `push` and/or `pull_request` to backend-related branches (e.g. `main`, `dev`, feature branches).
- May also be used on release tags when building for deployment.

**When it fails**

- Tests or linting fail.
- The backend does not build or dependencies cannot be installed.

Resolve all failing tests/lint issues locally, re-run them (see section 4), and then push the fixes.

---

### 1.3 `security-scans.yml`

**Purpose**

- Run **security scanning** for the application:
  - OWASP ZAP scan (dynamic application security testing for the frontend).
  - Dependency vulnerability checks for server and client.

**Jobs**

1. **`zap-scan`**

   - Checks out the code.
   - Runs OWASP ZAP from the official Docker image against `http://localhost:3000` (or URL configured in the workflow).
   - Uses `security/zap-config.json` to configure the scan.
   - Writes reports into `zap-report/` and uploads them as artifacts (`zap-report.html` / `.xml`).

   > For accurate ZAP results, the target application (frontend) typically needs to be running.  
   > If the target URL is not reachable, this step may fail and should be adjusted in the workflow.

2. **`dependency-scan`**

   - Checks out the code.
   - Sets up Node.js.
   - Installs dependencies for **server** (`server/`) and **client** (`client/`).
   - Runs:

     ```bash
     # server
     npm audit --production --audit-level=high --json > ../audit-server.json

     # client
     npm audit --production --audit-level=high --json > ../audit-client.json
     ```

   - Uploads `audit-server.json` and `audit-client.json` as artifacts.

**Vulnerability policy**

- The pipeline is configured to **fail only on `high` or `critical` vulnerabilities**.
- `low` and `moderate` findings are logged in the audit reports and should be reviewed regularly, but they do **not** break CI by default.
- Any accepted risk (for example the current `fast-redact` / `pino` / `elastic-apm-node` low-severity chain) should be:
  - documented in an issue or internal note, and
  - revisited when upstream fixes become available.

**Typical triggers**

- Scheduled run: `cron: '0 3 * * 0'` (Sundays at 03:00 UTC).
- Manual trigger via **Actions → Security Scans → Run workflow**.

---

### 1.4 Other workflows

Depending on the repository, you may also see additional workflows such as:

- `client-ci.yml` – CI for the React frontend (`client/`).
- Deploy / release workflows – build and push Docker images or deploy to staging/production.
- Lint-only workflows – for ESLint or TypeScript checks.

These should follow the same conventions: clear purpose, explicit triggers, and fail only on issues that must block a merge.

---

## 2. Secrets Management

All sensitive values must be stored in **GitHub Secrets** (Repository or Organization level).  
Never commit secrets to the repository.

### 2.1 Adding secrets

1. Navigate to **Settings → Secrets and variables → Actions**.  
2. Click **New repository secret**.  
3. Add required secrets, for example:

**Backend / Auth / Database**

- `MONGO_URI`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`

**Stripe / Billing**

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

**CI / Tests / Tools**

- `TEST_PASSWORD`
- `PERF_PASSWORD`
- `CYPRESS_TEST_PASSWORD`
- Any additional credentials used by external services (email providers, log services, etc.)

Reference secrets in workflows using:

```yaml
env:
  STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
```

or per-step:

```yaml
- name: Example step
  run: echo "Using secret value"
  env:
    MY_SECRET: ${{ secrets.MY_SECRET }}
```

### 2.2 Best practices

* **Limit scope**

  * Use separate secrets for **development**, **staging**, and **production** environments.
  * Prefer **GitHub Environments**:

    * `staging` environment has staging-only secrets.
    * `production` environment has production-only secrets and protections.

* **Rotate regularly**

  * Rotate API keys, access tokens, and passwords periodically.
  * Immediately rotate secrets if you suspect they may have been leaked.

* **Audit usage**

  * Review who can read or modify secrets.
  * Clean up unused secrets when services are removed or replaced.

* **Never log secrets**

  * Do not `echo` secrets directly in workflow logs.
  * Use masking (GitHub does this automatically for secrets) and avoid printing full URLs with embedded credentials.

---

## 3. Branches, Triggers, and Policies

### 3.1 Typical branch flow

* `main` – stable, production-ready branch.
* `dev` or feature branches – active development.

Pull requests into `main` (and optionally `dev`) should:

* run all relevant CI workflows (`server-ci`, `client-ci`, `openapi-ci`),
* run security scanning (`security-scans` either on schedule or on demand),
* be merged only when all required checks are green.

### 3.2 Required checks (recommended)

For higher safety, mark at least the following as **required** checks before merging into `main`:

* Backend CI (`server-ci.yml`)
* Client CI (`client-ci.yml`, if present)
* OpenAPI CI (`openapi-ci.yml`)
* Security Scans (`security-scans.yml`)

This ensures that:

* the backend builds and tests pass,
* the frontend builds and tests pass,
* the API documentation is valid,
* there are no high/critical security issues.

---

## 4. Local Preflight Before Pushing

Running a lightweight set of checks locally before pushing reduces CI churn and makes debugging easier.

### 4.1 Backend preflight (server)

From `C:\Loventia.app-new\server`:

```powershell
npm ci
npm test
npm audit --production --audit-level=high
```

### 4.2 Frontend preflight (client)

From `C:\Loventia.app-new\client`:

```powershell
npm ci
npm test
npm audit --production --audit-level=high
```

---

## 5. Reading and Handling CI Failures

When a workflow fails:

1. Go to **GitHub → Actions**.
2. Select the failing workflow run.
3. Open the job and step with the red ❌ icon.
4. Read the logs from top to bottom and identify the **first real error** (not just the final summary).

Common cases:

* **OpenAPI CI fails**

  * Check `server/openapi/openapi.yaml` and `.spectral.yaml`.
  * Fix lint errors (missing `description`, broken `$ref`, invalid types).
  * Re-run the workflow.

* **Server CI fails**

  * Run `npm ci` and `npm test` locally in `server/`.
  * Fix failing tests or linting, then push again.

* **Client CI fails**

  * Run `npm ci` and `npm test` locally in `client/`.
  * Fix React/JS/TS issues reported by tests or ESLint.

* **Security Scans fail**

  * If the failure is due to `npm audit`:

    * Check the `audit-server.json` / `audit-client.json` artifacts.
    * For **high/critical** vulnerabilities:

      * try `npm audit fix`,
      * or upgrade offending dependencies in `package.json`,
      * avoid `npm audit fix --force` unless you understand and accept breaking changes.
    * For low/moderate findings:

      * document accepted risks,
      * track upgrades over time.

  * If the failure is in the `zap-scan`:

    * Ensure the target URL is correct and reachable.
    * Adjust the ZAP config or disable certain rules only with good reason.

Resolve the root cause, commit the fix, and re-run the workflow.

---

## 6. Future Improvements

Planned improvements for the CI/CD setup include:

* Enforcing ESLint in CI for both server and client (B-phase).
* Adding Docker build and smoke tests to CI for backend (and optionally frontend).
* Adding Lighthouse / performance budgets to the frontend build pipeline.
* Documenting deployment and rollback steps in more detail (`docs/env.md`, deployment runbooks).

---

*Last updated: November 18, 2025*


