# CI/CD Documentation

This document explains our GitHub Actions workflows, secrets management, and best practices for continuous integration and delivery.

---

## 1. Workflows Overview

All workflows are located in `.github/workflows/`.

### 1.1 `ci.yml`

… (rest of workflows)

---

## 2. Secrets Management

All sensitive values must be stored in **GitHub Secrets** (Repository or Organization level):

1. Navigate to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**.
3. Add secrets such as:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `STRIPE_SECRET_KEY`
   - `PAYPAL_SECRET`
   - `DOCKER_PASSWORD`
   - `SLACK_WEBHOOK_URL`
4. Reference secrets in workflows using `${{ secrets.SECRET_NAME }}`.

**Best practices:**

- **Limit scope:** Use environment-level secrets (e.g. separate staging vs. production).
- **Rotate regularly:** Periodically update keys and tokens.
- **Audit usage:** Review who can read or modify secrets.

---

_Last updated: August 1, 2025_
