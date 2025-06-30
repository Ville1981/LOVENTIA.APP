# Date App

A full-stack dating application with both **server** (Node.js/Express, MongoDB) and **client** (Vite + React, Tailwind CSS). Features include user registration, authentication, profile management, image uploads, subscription payments (Stripe & PayPal), and admin tools.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Variables](#environment-variables)
5. [Running the App](#running-the-app)

   * [Server](#server)
   * [Client](#client)
6. [Docker Setup (Optional)](#docker-setup-optional)
7. [API Documentation](#api-documentation)
8. [Image Upload API](#image-upload-api)
9. [Client API Abstraction](#client-api-abstraction)
10. [Testing & CI/CD](#testing--cicd)
11. [Commit Convention & Code Style](#commit-convention--code-style)

---

## Features

* **User Authentication**: JWT-based login & registration
* **Profile Management**: Update profile fields, upload avatar & extra images
* **Subscriptions**: Free vs. Premium plans (image limits)
* **Payments**: Stripe Checkout & PayPal integration
* **Image Uploads**: Multer-powered file handling
* **Admin Tools**: Hide/show users, delete accounts
* **Real-time Webhooks**: Stripe & PayPal event handling
* **API Documentation**: OpenAPI/Swagger spec
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
   ```

2. **Install dependencies**

   ```bash
   # Server
   cd server && npm install

   # Client
   cd ../client && npm install
   ```

---

## Environment Variables

Copy example files and populate with your credentials:

```bash
# Server
cp server/.env.example server/.env

# Client (if needed)
# Ensure client/.env.example exists; if not, create it with CONTENTS:
# VITE_API_BASE_URL=http://localhost:5000/api
cp client/.env.example client/.env
```

**Server `.env`**

```
PORT=5000
MONGO_URI=<your-mongo-uri>
JWT_SECRET=<your-jwt-secret>
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

```
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
* Swagger UI (after setup): `http://localhost:5000/api-docs`

### Client

```bash
cd client
npm run dev
```

* Runs on: `http://localhost:5174`

---

## Docker Setup (Optional)

Containerize services using Docker Compose (no `version` field needed with Compose V2):

```yaml
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

### Docker Desktop Auto-Start

To ensure Docker Desktop is always running when you log in:

1. Open **Docker Desktop** from the Start Menu.
2. Click the **Settings** (gear) icon in the top-right corner.
3. In **General** settings, enable **Start Docker Desktop when you log in**.
4. Click **Apply & Restart** if prompted.

Once enabled, Docker will automatically launch on system boot, and you can immediately run:

````bash
# From your project root
docker compose up -d
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
  mongo_data:
````

## API Documentation

OpenAPI spec: `server/swagger.yaml` or `server/openapi.json`

**Integrate Swagger UI**:

```bash
npm install swagger-ui-express
```

In Express app:

```js
import swaggerUi from 'swagger-ui-express';
import spec from './swagger.yaml';
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
```

---

## Image Upload API

### 1. Upload Profile Avatar

```
POST /api/images/:userId/upload-avatar
```

* **Headers**: `Authorization: Bearer <token>`
* **Form Data**: `avatar` (single file)

```bash
curl -X POST http://localhost:5000/api/images/USER_ID/upload-avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/path/to/avatar.jpg"
```

### 2. Upload Extra Photos

```
POST /api/images/:userId/upload-photos
```

* **Headers**: `Authorization: Bearer <token>`
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
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const uploadPhotos = (userId, files) => {
  const form = new FormData();
  files.forEach(f => form.append('photos', f));
  return axios.post(`/api/images/${userId}/upload-photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
```

---

## Testing & CI/CD

* **Server Tests**: Jest & Supertest (`server/tests`)
* **Client Tests**: React Testing Library (`client/src/__tests__`)
* **CI**: Example GitHub Actions in `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { 'node-version': '16' }
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

---

## Commit Convention & Code Style

* **Linting**: ESLint with \[your-config]
* **Formatting**: Prettier
* **Commit Messages**: Conventional Commits

  * `feat: add new feature`
  * `fix: bug fix`
  * `docs: documentation only changes`
  * `chore: build process or auxiliary tool changes`

---

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
