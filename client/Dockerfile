# File: client/Dockerfile

# --- REPLACE START: Stable client build with Vite ---
FROM node:18-slim AS builder
WORKDIR /app

# Install deps for native addons (esbuild, vite, etc.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ libc6 \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy rest of the app
COPY . .

# Build client with Vite
RUN npm run build

# --- Runtime stage (nginx to serve static files) ---
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
# --- REPLACE END ---
