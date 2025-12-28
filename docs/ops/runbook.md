````md
# PATH: docs/ops/runbook.md

<!-- // --- REPLACE START: Ops Runbook cleanup (canonical index + incident actions; consistent language/links) --- -->

# Ops Runbook (Loventia)

> **Purpose:** A single “index + quick actions” page for incidents and production operations.  
> **Scope:** CI/CD, rollback, Stripe cutover, security hardening, test plan, admin endpoints.  
> **Rule:** During an active incident, prefer **rollback** over “hot fixes”.

---

## 1) Links (canonical docs)

### CI/CD
- **CI/CD guide:** [`../ci-cd.md`](../ci-cd.md)

### Rollback (canonical)
- **Rollback playbook (canonical):** [`./rollback-playbook.md`](./rollback-playbook.md)

> Note: `docs/rollback-playbook.md` should be a **pointer** file that redirects here so we avoid maintaining two conflicting playbooks.

### Stripe
- **Stripe live cutover:** [`../stripe-live-cutover.md`](../stripe-live-cutover.md)

### Security
- **Security hardening:** [`../security-hardening.md`](../security-hardening.md)

### Testing
- **Test plan:** [`../test-plan.md`](../test-plan.md)

### Admin
- **Admin endpoints:** [`../admin-endpoints.md`](../admin-endpoints.md)

---

## 2) Quick commands (when prod is broken)

> Use these as a minimal first response: confirm → scope → rollback if needed.

### 2.1 Identify environment & AWS identity

```bash
aws sts get-caller-identity
aws configure list
````

### 2.2 Frontend “is the site up” (CloudFront / static)

```bash
# Replace with your real domain when you have one.
# For CloudFront default domain, use: https://<dist>.cloudfront.net/
curl -I https://<frontend-domain>/
curl -I https://<frontend-domain>/discover
```

If the page loads but looks broken:

* Open DevTools → **Console** + **Network**
* Hard refresh (Ctrl+F5)
* Confirm the newest JS/CSS files load (no 403/404)

### 2.3 Backend “is the API up” (health/ready)

```bash
curl -fsS https://<api-domain>/health
curl -fsS https://<api-domain>/ready
```

If `/health` is OK but `/ready` fails:

* Suspect DB connectivity, migrations, or a downstream dependency.

### 2.4 ECS quick checks (if backend runs on ECS)

```bash
AWS_REGION="eu-north-1"
CLUSTER_NAME="<your-ecs-cluster>"
SERVICE_NAME="<your-ecs-service>"

# Service status + current task definition
aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,Pending:pendingCount,TaskDef:taskDefinition,Deployments:deployments}' \
  --output json

# Recent running tasks
aws ecs list-tasks \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --service-name "$SERVICE_NAME" \
  --desired-status RUNNING \
  --max-items 10

# If you know a task ARN, describe it
TASK_ARN="<task-arn>"
aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --tasks "$TASK_ARN" \
  --output json
```

### 2.5 Rollback fast (link)

If a deploy likely caused the incident, jump here:

* **Canonical rollback playbook:** [`./rollback-playbook.md`](./rollback-playbook.md)

### 2.6 CloudFront invalidate (frontend stale/broken assets)

```bash
DISTRIBUTION_ID="<your-cloudfront-distribution-id>"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
```

---

## 3) Where are logs?

### Frontend (FE)

* **Browser DevTools**

  * Console errors (JS runtime)
  * Network tab (failed asset loads, 403/404/5xx)
* **CloudFront**

  * Distribution metrics (Requests, 4xx/5xx)
  * (Optional) Access logs to S3 (if enabled)
* **Sentry / client error tracking**

  * If enabled, use Sentry to correlate spikes with release version.

### Backend (BE)

Depends on deployment target:

* **ECS / CloudWatch Logs**

  * CloudWatch log groups for the service/task
  * Look for:

    * auth failures (401/403 spikes)
    * webhook errors
    * DB connection errors
    * unhandled exceptions
* **Load balancer (if used)**

  * ALB target health
  * ALB 5xx/4xx spikes
* **Local dev**

  * Server console output
  * Any `logs/` folder (if configured)

### AWS services (infra)

* **Route 53**: DNS record health / propagation
* **ACM**: cert validation / status (CloudFront requires certs in **us-east-1**)
* **S3**: object existence + permissions + CORS
* **CloudFront**: caching, invalidations, origin errors (403/404/5xx)

---

## 4) Common incidents (what to check first)

### 4.1 Stripe webhook failures

**Symptoms**

* Users pay but premium does not activate
* `POST /api/billing/sync` fails or premium state “lags”
* Webhook endpoint returns 400/500

**Checklist**

1. Stripe Dashboard → Developers → Logs (find the event)
2. Confirm webhook secret and endpoint URL are correct:

   * `STRIPE_WEBHOOK_SECRET` on server
3. Check server logs for:

   * signature verification errors
   * parsing errors (raw body / middleware order)
4. Confirm webhook returns **2xx** quickly
5. If needed: run a manual sync flow (authenticated/admin endpoint)

**Helpful commands**

```bash
curl -fsS https://<api-domain>/health
# If you have a billing sync endpoint:
# curl -fsS -H "Authorization: Bearer <token>" https://<api-domain>/api/billing/sync
```

---

### 4.2 Login failures / auth refresh loop

**Symptoms**

* Users cannot log in
* Login returns 401/500
* Frontend stuck refreshing tokens

**Checklist**

1. Confirm backend is healthy (`/health`, `/ready`)
2. Check env:

   * JWT secrets (access + refresh)
   * cookie settings (SameSite/Secure/Path)
   * CORS allowed origins + credentials
3. Confirm time is sane on server (clock drift can break JWT)
4. Inspect server logs around:

   * login
   * refresh
   * cookie parsing

---

### 4.3 5xx spike / timeouts

**Symptoms**

* ALB/CloudFront shows a 5xx spike
* API requests time out
* DB connection errors

**Checklist**

1. Check whether the spike correlates with a deploy time
2. Check ECS:

   * running vs desired tasks
   * last deployment events
3. Check DB availability / pool saturation
4. If deploy-related: **rollback**

---

### 4.4 S3 images broken (403/404 / slow)

**Symptoms**

* Profile images do not load
* `<img>` shows broken or 403/404
* Some users affected, others not

**Checklist**

1. Confirm the URL is correct and the object exists:

   * bucket, key, region
2. Check S3 permissions / bucket policy:

   * public read vs signed URLs
3. Check CORS rules (browser blocks)
4. If behind CloudFront:

   * invalidate cache
   * confirm origin access settings
5. Verify from a client machine:

   * `curl -I <image-url>` should be 200

---

## 5) Incident notes template (optional but useful)

When the incident is resolved, capture:

* Start time / end time
* Impact
* Root cause (short)
* Fix (rollback / config change / code patch)
* Prevention action (one concrete item)

<!-- // --- REPLACE END: Ops Runbook cleanup (canonical index + incident actions; consistent language/links) --- -->

```
::contentReference[oaicite:0]{index=0}
```

