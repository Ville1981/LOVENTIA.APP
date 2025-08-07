# server/Dockerfile

# --- REPLACE START: Multi-stage build for server with Sentry and healthcheck ---

# 1) Builder stage: install all dependencies (including Sentry) and build
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy only package definitions and configs
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and build server
COPY . .
RUN npm run build

# 2) Production stage: minimal runtime with node_modules preserved
FROM node:18-alpine AS runner
WORKDIR /usr/src/app

# Copy built artifacts and package files (to preserve dependency tree)
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Set environment
ENV NODE_ENV=production
# SENTRY_DSN should be injected at runtime (docker run -e SENTRY_DSN=...)
EXPOSE 5000

# Define healthcheck for orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
# --- REPLACE END ---
