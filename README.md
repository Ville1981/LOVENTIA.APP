# Date App

A full-stack dating application API and front-end. This repo includes both the **server** (Node.js/Express, MongoDB) and **client** (Vite + React, Tailwind CSS), with support for user registration, authentication, profile management, image uploads, subscription payments (Stripe & PayPal), and admin functionality.

---

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Environment Variables](#environment-variables)
* [Running the App](#running-the-app)

  * [Server](#server)
  * [Client](#client)
* [Docker Setup (Optional)](#docker-setup-optional)
* [API Documentation](#api-documentation)
* [Image Upload API](#image-upload-api)
* [Client API Abstraction](#client-api-abstraction)
* [Testing & CI/CD](#testing--cicd)

---

## Features

* **User Authentication**: JWT-based login and registration
* **Profile Management**: Update profile, upload avatar & extra images
* **Subscriptions**: Free vs. premium plans with image limits
* **Payments**: Stripe Checkout & PayPal integration
* **Image Uploads**: Multer-powered file handling
* **Admin Tools**: Hide/show users, delete accounts
* **Real-time**: Webhook endpoints for Stripe & PayPal
* **Documentation**: OpenAPI/Swagger spec
* **Ready for CI/CD**: GitHub Actions example

---

## Prerequisites

* Node.js >= v16
* npm or Yarn
* MongoDB instance (Atlas or local)
* Stripe account and API keys
* PayPal Developer account and API credentials

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/date-app.git
   cd date-app
   ```
2. Install dependencies for both server and client:

   ```bash
   cd server
   npm install

   cd ../client
   npm install
   ```

---

## Environment Variables

Copy the example file and fill in your credentials:

```bash
# in server/
cp .env.example .env
# in client/
cp .env.example .env  # if client needs env
```

Edit `.env` values:

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

---

## Running the App

### Server

```bash
cd server
npm run dev
```

* Runs on `http://localhost:5000`
* Swagger UI: `http://localhost:5000/api-docs` (once swagger-ui is set up)

### Client

```bash
cd client
npm run dev
```

* Runs on `http://localhost:5174`

---

## Docker Setup (Optional)

A `Dockerfile` and `docker-compose.yml` can be added to containerize both server and client.

Example `Dockerfile` for server:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

Basic `docker-compose.yml`:

```yaml
version: '3.8'
services:
  server:
    build: ./server
    env_file: ./server/.env
    ports:
      - '5000:5000'
    volumes:
      - ./server:/app

  client:
    build: ./client
    env_file: ./client/.env
    ports:
      - '5174:5174'
    volumes:
      - ./client:/app
```

---

## API Documentation

OpenAPI spec is located at `server/swagger.yaml`. Integrate with Swagger UI or Redoc:

```bash
npm install swagger-ui-express
# then mount in your Express app
```

---

## Image Upload API

The backend provides two endpoints for handling image uploads. Both expect a `POST` request with `multipart/form-data`:

### 1. Upload Profile Avatar

```
POST /api/images/:userId/upload-avatar
```

* **Headers**: `Authorization: Bearer <token>`
* **Form Data**:

  * `avatar` — Single image file (JPEG, PNG, etc.)

**Example with cURL**:

```bash
curl -X POST "http://localhost:5000/api/images/USER_ID/upload-avatar" \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/path/to/avatar.jpg"
```

### 2. Upload Extra Photos

```
POST /api/images/:userId/upload-photos
```

* **Headers**: `Authorization: Bearer <token>`
* **Form Data**:

  * `photos` — One or more image files. Use the same field name for each file.

**Example with cURL**:

```bash
curl -X POST "http://localhost:5000/api/images/USER_ID/upload-photos" \
  -H "Authorization: Bearer $TOKEN" \
  -F "photos=@/path/to/photo1.png" \
  -F "photos=@/path/to/photo2.jpg"
```

---

## Client API Abstraction

The client code includes wrapper functions in `client/src/api/images.js` for easy integration:

```js
import axios from 'axios';

export const uploadAvatar = (userId, file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return axios.post(
    `/api/images/${userId}/upload-avatar`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};

export const uploadPhotos = (userId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  return axios.post(
    `/api/images/${userId}/upload-photos`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};
```

* **Location**: `client/src/api/images.js`
* **Usage**: import and call these functions in your React components, passing `userId` and file(s).

---

## Testing & CI/CD

* **Server Tests**: Jest & supertest in `server/tests`
* **Client Tests**: React Testing Library in `client/src/__tests__`
* **CI**: Example GitHub Actions workflow in `.github/workflows/ci.yml`

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
        // other profile fields...
    }
    MESSAGE {
        ObjectId _id
        ObjectId sender
        ObjectId receiver
        String content
        Date createdAt
    }
```
