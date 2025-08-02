# 1) Build stage
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json vite.config.* ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime stage (nginx)
FROM nginx:alpine

# --- REPLACE START: ensure non-root user and add healthcheck ---
# Switch to nginx user (UID 101 by default)
USER nginx

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost/ || exit 1
# --- REPLACE END ---

# Remove default html and copy built assets
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config (if any)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
