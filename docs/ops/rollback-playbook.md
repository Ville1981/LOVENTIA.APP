````md
# PATH: docs/ops/rollback-playbook.md

# Rollback Playbook (ECS/Fargate + S3/CloudFront)

<!-- // --- REPLACE START: Rollback Playbook cleanup (language, structure, consistency; keep intent intact) --- -->

> **Goal:** Restore a known-good version quickly when a deploy causes an incident.  
> **Scope:** Backend on **ECS/Fargate** + frontend on **S3 + CloudFront**.  
> **Safety rule:** During an active incident, prefer a rollback over a “hot fix”.

---

## 0) Preconditions (do this first)

1) **Confirm the incident**
- What broke? (5xx spike, login failures, blank UI, timeouts, etc.)
- When did it start? (compare to the deploy timestamp if possible)

2) **Collect minimum context**
- Latest deploy identifier (git SHA, image tag, pipeline run ID)
- Which environment? (staging / production)
- Who is on-call and who approves rollbacks (if applicable)

3) **Decide rollback scope**
- **Backend only:** API is broken but UI loads
- **Frontend only:** UI is broken but API is healthy
- **Both:** common after breaking changes

> Tip: If you have an ALB/API domain, keep a terminal running a repeating health check while you roll back.

---

## 1) Roll back backend (ECS/Fargate)

### Option A — Roll back to a previous task definition (recommended)

Use this when you know a previous task definition is good.

```bash
# Set these explicitly (avoid relying on hidden shell state)
AWS_REGION="eu-north-1"
CLUSTER_NAME="<your-ecs-cluster>"
SERVICE_NAME="<your-ecs-service>"
TASK_FAMILY="<your-task-family>"

# 1) Check the currently running task definition
aws ecs describe-services \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --query 'services[0].taskDefinition' \
  --output text

# 2) List recent task definitions (newest first)
aws ecs list-task-definitions \
  --region "$AWS_REGION" \
  --family-prefix "$TASK_FAMILY" \
  --sort DESC \
  --max-items 10

# 3) Pick a known-good previous task definition ARN
PREV_TASK_DEF_ARN="arn:aws:ecs:eu-north-1:123456789012:task-definition/<your-task-family>:123"

# 4) Update service to the previous task definition and force a new deployment
aws ecs update-service \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --task-definition "$PREV_TASK_DEF_ARN" \
  --force-new-deployment

# 5) Wait until ECS reports the service as stable
aws ecs wait services-stable \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME"
````

**After Option A**

* Confirm the new tasks are running and old tasks are drained.
* If errors persist: check CloudWatch logs and ALB target health.

---

### Option B — Roll back by pinning a specific image tag (advanced)

Use this when you must roll back to a known-good image tag, but recent task definitions are not trusted.

```bash
AWS_REGION="eu-north-1"
CLUSTER_NAME="<your-ecs-cluster>"
SERVICE_NAME="<your-ecs-service>"

IMAGE_URI="<account>.dkr.ecr.eu-north-1.amazonaws.com/<repo>:prod-YYYYMMDD-HHMM"

# This assumes you keep a task definition template in the repo.
# Replace the container index/name as needed for your task definition.
jq --arg IMAGE "$IMAGE_URI" \
  '.containerDefinitions[0].image |= $IMAGE' \
  server/ecs-taskdef.json > taskdef.rollback.json

# Register the task definition
aws ecs register-task-definition \
  --region "$AWS_REGION" \
  --cli-input-json file://taskdef.rollback.json

# Then update the ECS service to the newly registered task definition ARN.
# (Find it from the register-task-definition output or list-task-definitions)
# Example:
# NEW_TASK_DEF_ARN="arn:aws:ecs:eu-north-1:123456789012:task-definition/<family>:124"
# aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --task-definition "$NEW_TASK_DEF_ARN" --force-new-deployment
# aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME"
```

**Notes**

* If your task definition has multiple containers, update the correct container entry.
* Keep secrets/config unchanged unless the rollback explicitly requires older config.

---

## 2) Roll back frontend (S3 + CloudFront)

This restores the built static site. Use only a **known-good build** (artifact, tag, or a versioned `dist/` folder).

```bash
# Frontend bucket containing the built site (dist/)
BUCKET="<your-frontend-s3-bucket>"

# Sync the known-good build output to S3
aws s3 sync ./dist "s3://$BUCKET" --delete

# Invalidate CloudFront cache so users get the rolled-back assets
DISTRIBUTION_ID="<your-cloudfront-distribution-id>"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
```

**If you keep versioned builds (recommended)**

* Sync from a versioned folder/artifact:

  * Example: `./dist-prod-<tag>/` → S3

**Notes**

* CloudFront invalidations can take a bit to propagate.
* If the incident is limited, you can invalidate only specific paths (advanced).

---

## 3) Verify (required)

### Backend checks

```bash
# Health endpoint should return 200
curl -fsS https://<your-api-domain-or-alb>/health

# Optional readiness check if you have it
curl -fsS https://<your-api-domain-or-alb>/ready
```

### Frontend checks

* Open the site in an incognito/private window
* Hard refresh (Ctrl+F5) if needed
* Confirm critical flows:

  * Login
  * Discover loads
  * Profile/photos load (if applicable)

---

## 4) Post-rollback checklist (do not skip)

* **Announce status:** “Rollback complete, monitoring for 15–30 minutes”
* **Capture evidence:** timestamps, what version was restored, symptoms observed
* **Open a follow-up issue:** root cause analysis + prevention steps
* **Freeze further deploys** until the incident is understood (if your process supports it)

---

## 5) Troubleshooting (quick cues)

* **ECS stable but API still failing**

  * Check CloudWatch logs for the new tasks
  * Check ALB target group health and security group rules
  * Confirm env vars/secrets are present for the rolled-back version

* **Frontend looks unchanged after rollback**

  * Ensure the correct bucket was updated
  * Confirm CloudFront invalidation completed
  * Verify the client is not pinned to cached assets (try private window)

<!-- // --- REPLACE END: Rollback Playbook cleanup (language, structure, consistency; keep intent intact) --- -->

```
::contentReference[oaicite:0]{index=0}
```

