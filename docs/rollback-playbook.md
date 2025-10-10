# File: docs/rollback-playbook.md

# --- REPLACE START: ECS + CloudFront rollback playbook ---
# Loventia – Rollback Playbook (ECS + CloudFront)

> Purpose: Quickly revert the backend to the **previous ECS task definition** and optionally invalidate CloudFront for the frontend.

---

## Prerequisites

- AWS CLI v2 configured (`aws sts get-caller-identity` works).
- Permissions: ECS (read/update), ECR (read), CloudFront (create invalidation).
- Know your:
  - `ECS_CLUSTER` (e.g., `loventia-staging`)
  - `ECS_SERVICE` (e.g., `loventia-server`)
  - `CLOUDFRONT_DISTRIBUTION_ID` (only for frontend cache purge)

---

## A) Roll back ECS service to the previous task definition

### 1) Inspect current and previous task definitions
```bash
aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --query 'services[0].taskDefinition' --output text

aws ecs list-task-definitions \
  --family-prefix <your-task-family> \
  --sort DESC --max-items 5




# File: docs/rollback-playbook.md

# --- REPLACE START: ECS + CloudFront rollback playbook ---
# Rollback Playbook (ECS service + CloudFront)

## 1. Preconditions
- AWS CLI v2 toimii ( `aws sts get-caller-identity` ).
- Sinulla on riittävät oikeudet ECS:ään ja CloudFrontiin.

## 2. Tarkista mikä on “current” ja “previous”
```bash
aws ecs describe-services \
  --region eu-north-1 \
  --cluster <CLUSTER> \
  --services <SERVICE> \
  | jq -r '.services[0].taskDefinition'
,,,,