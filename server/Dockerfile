# 1) Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Copy only package and tsconfig to leverage cache
COPY package*.json tsconfig*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 2) Runtime stage
FROM node:18-alpine
WORKDIR /usr/src/app

# --- REPLACE START: non-root user setup and healthcheck ---
# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose health endpoint check (assumes GET /healthz returns 200)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:5000/healthz || exit 1
# --- REPLACE END ---

# Copy production build and package files
COPY --from=builder --chown=appuser:appgroup /usr/src/app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /usr/src/app/package*.json ./

RUN npm ci --only=production

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
