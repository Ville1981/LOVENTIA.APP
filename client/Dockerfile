# client/Dockerfile

# --- REPLACE START: multi-stage build for React app with nginx fallback ---

# 1) Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json vite.config.js ./
# Käytä npm ci jos package-lock.json on olemassa, muuten fallback npm installiin
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install --legacy-peer-deps; \
    fi

# Copy source and build
COPY . .
RUN npm run build


# 2) Runtime stage
FROM nginx:alpine

# Set working directory to nginx html folder
WORKDIR /usr/share/nginx/html

# Remove default static contents
RUN rm -rf ./*

# Copy build artifacts from builder
COPY --from=builder /app/dist .

# Replace default nginx config with SPA-friendly config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 and start nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
# --- REPLACE END ---
