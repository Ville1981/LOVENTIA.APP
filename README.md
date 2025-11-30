````markdown
# PATH: README.md

# Loventia.app

A full-stack dating application with both **server** (Node.js/Express, MongoDB) and **client** (Vite + React, Tailwind CSS). Features include user registration, authentication, profile management, image uploads, subscription payments (Stripe & PayPal), and admin tools.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Quick start for new developers](#quick-start-for-new-developers)
5. [Environment Variables](#environment-variables)
6. [Running the App](#running-the-app)
   * [Server](#server)
   * [Client](#client)
7. [Docker Setup (Optional)](#docker-setup-optional)
8. [Docker Desktop Auto-Start](#docker-desktop-auto-start)
9. [API Documentation](#api-documentation)
10. [Authentication (IMPORTANT)](#authentication-important)
11. [Documentation & Infrastructure](#documentation--infrastructure)
    * [Version Control Workflow](#version-control-workflow)
    * [CI/CD Documentation](#cicd-documentation)
12. [Image Upload API](#image-upload-api)
13. [Client API Abstraction](#client-api-abstraction)
14. [Testing & CI/CD](#testing--cicd)
15. [Commit Convention & Code Style](#commit-convention--code-style)
16. [ER Diagram](#er-diagram)

---

## Features

* **User Authentication**: JWT-based login & registration
* **Profile Management**: Update profile fields, upload avatar & extra images
* **Subscriptions**: Free vs. Premium plans (image limits)
* **Payments**: Stripe Checkout & PayPal integration
* **Image Uploads**: Multer-powered file handling
* **Admin Tools**: Hide/show users, delete accounts
* **Real-time Webhooks**: Stripe & PayPal event handling
* **API Documentation**: OpenAPI/Swagger spec at `/api/docs` (after setup)
* **CI/CD Ready**: GitHub Actions example workflows

---

## Prerequisites

* **Node.js** >= v16
* **npm** or **Yarn**
* **MongoDB** instance (Atlas or local)
* **Stripe** account & API keys
* **PayPal** Developer account & credentials

---

## Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/your-username/date-app.git
   cd date-app
````

2. **Install dependencies**

   ```bash
   # Server
   cd server && npm install

   # Client
   cd ../client && npm install
   ```

---

<!-- --- REPLACE START: Quick start for new developers --- -->

## Quick start for new developers

This section is a **short, practical path** to get Loventia running locally and verify that the core API is healthy.

1. **Prepare environment files**

   From the project root:

   ```bash
   # Server
   cp server/.env.example server/.env

   # Client
   cp client/.env.example client/.env
   ```

   Then edit:

   * `server/.env` → set at least:

     * `MONGO_URI`
     * `JWT_SECRET`
     * `REFRESH_TOKEN_SECRET`
     * `STRIPE_SECRET_KEY`
     * `STRIPE_WEBHOOK_SECRET`
     * `STRIPE_PREMIUM_PRICE_ID`
     * `CLIENT_URL=http://localhost:5174`
   * `client/.env` → set:

     * `VITE_API_BASE_URL=http://localhost:5000/api`

2. **Start MongoDB (local or Docker)**

   *Option A – Local MongoDB service* (if installed):

   ```bash
   # On Windows, Mongo usually runs as a service automatically.
   # On Linux / macOS you might need:
   sudo systemctl start mongod
   ```

   *Option B – Mongo in Docker*:

   From the project root:

   ```bash
   docker compose up -d mongo
   ```

   Make sure `MONGO_URI` in `server/.env` points to that instance, e.g.:

   ```ini
   MONGO_URI=mongodb://127.0.0.1:27017/loventia
   ```

3. **Start the backend API**

   ```bash
   cd server
   npm run dev
   ```

   The API should now be available at:

   ```text
   http://localhost:5000
   ```

4. **Start the frontend client**

   In a second terminal:

   ```bash
   cd client
   npm run dev
   ```

   By default Vite serves the client at:

   ```text
   http://localhost:5174
   ```

5. **Smoke-test the API (health + login + /api/auth/me)**

   From **PowerShell** (Windows), after you have a test user created:

   ```powershell
   $ErrorActionPreference = 'Stop'
   $BaseUrl = "http://127.0.0.1:5000"

   Write-Host "==> Health-check..." -ForegroundColor Cyan
   $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET
   Write-Host "Health OK" -ForegroundColor Green

   # Replace with a real test user (Free or Premium)
   $email    = "testuser1@example.com"
   $password = "Test1234!"

   Write-Host "`n==> Login..." -ForegroundColor Cyan
   $bodyJson = @{ email = $email; password = $password } | ConvertTo-Json
   $login    = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body $bodyJson -ContentType "application/json"

   $token = $login.accessToken
   Write-Host "Login OK, token prefix: $($token.Substring(0,24))..." -ForegroundColor Green

   Write-Host "`n==> /api/auth/me..." -ForegroundColor Cyan
   $me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method GET -Headers @{ Authorization = "Bearer $token" }
   $me | Format-List email,premium,isPremium,@{Name="tier";Expression={$_.entitlements.tier}}
   ```

   If you see:

   * `Health OK`
   * `Login OK`
   * `/api/auth/me` returns `email` and `premium` / `isPremium` / `entitlements`,

   then your local environment is **basically healthy**.

6. **Optional: API docs & Stripe smoke tests**

   * To lint and bundle the OpenAPI spec:

     ```bash
     cd server
     powershell -ExecutionPolicy Bypass -File .\openapi\openapi.ps1
     ```

   * To validate Stripe webhooks in dev, see the section
     **“Stripe CLI smoke (dev)”** under [Testing & CI/CD](#testing--cicd).

<!-- --- REPLACE END: Quick start for new developers --- -->

---

## Environment Variables

Copy example files and populate with your credentials:

```bash
# Server
cp server/.env.example server/.env

# Client
cp client/.env.example client/.env
```

**Server `.env`**

```ini
PORT=5000
MONGO_URI=<your-mongo-uri>

# --- REPLACE START: JWT/env alignment with src/utils/generateTokens.js & src/utils/jwt.js ---
# Access token secret (short-lived)
JWT_SECRET=dev_access_secret

# Refresh token secret (long-lived)
REFRESH_TOKEN_SECRET=dev_refresh_secret

# Optional: override expirations
# JWT_EXPIRES_IN=2h
# JWT_REFRESH_EXPIRES_IN=30d
# TOKEN_ISSUER=loventia-api
# --- REPLACE END ---

STRIPE_SECRET_KEY=<sk_test_xxx>
STRIPE_WEBHOOK_SECRET=<whsec_xxx>
STRIPE_PREMIUM_PRICE_ID=<price_xxx>
PAYPAL_CLIENT_ID=<your-paypal-client-id>
PAYPAL_SECRET=<your-paypal-secret>
PAYPAL_PREMIUM_PRICE=<12.00>
PAYPAL_WEBHOOK_ID=<your-paypal-webhook-id>
CLIENT_URL=http://localhost:5174
NODE_ENV=development
```

**Client `.env`**

```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Running the App

### Server

```bash
cd server
npm run dev
```

* Runs on: `http://localhost:5000`
* Swagger UI (after setup): `http://localhost:5000/api/docs` **(preferred)** or `http://localhost:5000/api-docs` (legacy)

### Client

```bash
cd client
npm run dev
```

* Runs on: `http://localhost:5174`

---

## Docker Setup (Optional)

Containerize services using Docker Compose:

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:6.0
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secret
    volumes:
      - mongo_data:/data/db
    ports:
      - '27017:27017'

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./server/.env
    ports:
      - '5000:5000'
    volumes:
      - ./server/uploads:/usr/src/app/uploads
      - ./server:/usr/src/app
      - /usr/src/app/node_modules
    depends_on:
      - mongo
    command: npm run dev

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - ./client/.env
    ports:
      - '5174:5174'
    volumes:
      - ./client:/app
      - /app/node_modules
    depends_on:
      - server
    command: npm run dev

volumes:
  mongo_data: {}
```

---

## Docker Desktop Auto-Start

To ensure Docker Desktop is always running when you log in:

1. Open **Docker Desktop** from the Start Menu.
2. Click the **Settings** (gear) icon in the top-right corner.
3. In **General** settings, enable **Start Docker Desktop when you log in**.
4. Click **Apply & Restart** if prompted.

Once enabled, Docker will automatically launch on system boot, and you can immediately run:

```bash
# From project root
docker compose up -d
```

---

## API Documentation

OpenAPI spec (recommended): `server/openapi/openapi.yaml`
Legacy: `server/openapi.yaml` or `server/openapi.json`

**Integrate Swagger UI**:

```bash
cd server
npm install swagger-ui-express yamljs
```

In Express app (`server/src/app.js` or `server/src/index.js`):

```js
// --- REPLACE START: Swagger integration ---
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load the main OpenAPI YAML from /server/openapi/openapi.yaml first
const swaggerDocument = YAML.load(
  path.join(__dirname, '../openapi/openapi.yaml')
);

// Mount under /api/docs so it matches the rest of the API
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// --- REPLACE END ---
```

> **Note:** Jos käytössä on erillinen `server/src/routes/index.js` joka mountataan `app.use('/api', routes);`, niin Swagger kannattaa mountata **suoraan appiin** kuten yllä, ei routesin sisään.

---

## Authentication (IMPORTANT)

Tämä on se osuus, jonka juuri testattiin PowerShellillä ja joka pitää **dokumentoituna** tässä repossa, jotta myöhemmin ei tule “miksi /api/users/login toimii joskus ja joskus ei” -kysymyksiä.

### 1. Primary endpoint (uusi, ESM, täysi)

```http
POST /api/auth/login
Content-Type: application/json
```

**Body:**

```json
{
  "email": "testuser1@example.com",
  "password": "Test1234!"
}
```

**Response (lyhennetty):**

```json
{
  "message": "Login successful.",
  "user": {
    "id": "690767bbdc9075ce9f0034c6",
    "email": "testuser1@example.com",
    "role": "user",
    "isPremium": false,
    "entitlements": { "tier": "free" }
  },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 7200
}
```

**Miksi tämä on ensisijainen?**
Koska se tulee suoraan tiedostosta `server/routes/auth.js` (ESM), jossa on nyt:

* `/api/auth/login`
* `/api/auth/refresh`
* `/api/auth/logout`
* `/api/auth/forgot-password`
* `/api/auth/reset-password`
* `/api/auth/me` (premium-tieto, entitlements, stripeCustomerId, jne)

### 2. Secondary / legacy endpoint (vain fallback)

```http
POST /api/users/login
```

Tämä pidetään vain sitä varten, että **vanhat clientit** tai **vanha frontend** tai **postman-sarjat** eivät hajoa. Uusi frontend tekee:

```text
try /api/auth/login → if 404/405 → try /api/users/login
```

### 3. Me-endpoint

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Tämä on nyt **ainoa** “oikea” me, koska:

* se palauttaa samat premium-tiedot kuin `/api/users/me`
* se käyttää samaa normalisoijaa kuin userRoutes
* se ei vuoda salasanaa
* se osaa luoda entitlements-olion vaikka kannassa ei vielä ole kaikkea

### 4. Private router (ei varjosta me:tä)

```http
GET /api/auth/private/ping
GET /api/auth/private/no-me
```

Nämä ovat vain diagnostiikkaa varten ja olemme erikseen tehneet:

* ei uutta `/me`:tä tänne
* tämä router vain todistaa, että `authenticate` toimii

### 5. Refresh

Tukee **kahta** tapaa (molemmat testattiin PS:llä):

1. **Bodyllä:**

   ```http
   POST /api/auth/refresh
   Content-Type: application/json

   {
     "refreshToken": "<refresh_jwt>"
   }
   ```

2. **Authorization-headerissa** (legacy):

   ```http
   POST /api/auth/refresh
   Authorization: Bearer <refresh_jwt>
   ```

Molemmissa tapauksissa saat uuden access-tokenin.

### 6. Forgot / reset

```http
POST /api/auth/forgot-password
{
  "email": "testuser1@example.com"
}
```

→ luo tokenin, tallentaa kannassa `passwordResetToken` ja `passwordResetExpires`, yrittää lähettää mailin (loggaa silti vaikka ei pysty lähettämään).

```http
POST /api/auth/reset-password
{
  "id": "690767bbdc9075ce9f0034c6",
  "token": "<raw OR sha256(token)>",
  "password": "NewStrongPassword!1"
}
```

→ hyväksyy sekä raakan että sha256-version, juuri sen takia että aiemmin oli se “hash vs raw” -ero.

---

## Documentation & Infrastructure

### Version Control Workflow

Document your branching strategy (e.g. Git-flow or trunk-based) and pull request conventions in `docs/version-control-workflow.md`.

### CI/CD Documentation

Describe GitHub Actions workflows, environment secrets management, and automated checks in `docs/ci-cd.md`.

---

## Image Upload API

### Upload Profile Avatar

```http
POST /api/images/:userId/upload-avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

* **Form Data**: `avatar` (single file)

```bash
curl -X POST http://localhost:5000/api/images/USER_ID/upload-avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/path/to/avatar.jpg"
```

### Upload Extra Photos

```http
POST /api/images/:userId/upload-photos
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

* **Form Data**: `photos` (multiple files)

```bash
curl -X POST http://localhost:5000/api/images/USER_ID/upload-photos \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@/path/to/photo1.png" \
  -F "photos=@/path/to/photo2.jpg"
```

---

## Client API Abstraction

Location: `client/src/api/images.js`

```js
import axios from 'axios';

export const uploadAvatar = (userId, file) => {
  const form = new FormData();
  form.append('avatar', file);
  return axios.post(`/api/images/${userId}/upload-avatar`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadPhotos = (userId, files) => {
  const form = new FormData();
  files.forEach((f) => form.append('photos', f));
  return axios.post(`/api/images/${userId}/upload-photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
```

---

## Testing & CI/CD

* **Server Tests**: Jest & Supertest (`server/tests`)
* **Client Tests**: React Testing Library (`client/src/__tests__`)
* **CI Workflow**: see `.github/workflows/ci.yml`, `staging-e2e.yml`, `production-deploy.yml`

Example CI workflow (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '16'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

<!-- Stripe CLI smoke test snippet -->

<!-- The replacement region marks exactly what was added for webhook testing -->

<!-- --- REPLACE START: Stripe CLI smoke (dev) --- -->

### Stripe CLI smoke (dev)

Quick way to validate webhook-only flow locally (Test mode):

```bash
# 1) Forward events from Stripe → local webhook endpoint
stripe listen --forward-to http://localhost:5000/webhooks/stripe

# 2) Simulate subscription activation and cancellation/update
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

<!-- --- REPLACE END --- -->

---

## Commit Convention & Code Style

* **Linting**: ESLint
* **Formatting**: Prettier
* **Commit Messages**: Conventional Commits

  * `feat: add new feature`
  * `fix: bug fix`
  * `docs: documentation only changes`
  * `chore: build process or auxiliary tool changes`

---

## ER Diagram

```mermaid
erDiagram
    USER ||--o{ SUBSCRIPTION : has
    USER ||--o{ IMAGE : owns
    USER ||--o{ MESSAGE : sends
    USER ||--o{ MESSAGE : receives

    SUBSCRIPTION {
        ObjectId _id
        ObjectId user
        String plan
        Date createdAt
    }
    IMAGE {
        ObjectId _id
        String url
        ObjectId owner
        Date uploaded
    }
    USER {
        ObjectId _id
        String username
        String email
        String password
        Boolean isPremium
        String profilePicture
        [String] extraImages
        [ObjectId] likes
        [ObjectId] superLikes
        [Date] superLikeTimestamps
        [ObjectId] blockedUsers
    }
    MESSAGE {
        ObjectId _id
        ObjectId sender
        ObjectId receiver
        String content
        Date createdAt
    }
```

```
```


