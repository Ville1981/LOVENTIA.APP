# --- REPLACE START: Debian-based runtime, force-correct sharp build (no nodemon) ---

FROM node:18-slim
WORKDIR /usr/src/app

# System tools for native addons (sharp, bcrypt, etc.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ curl \
 && rm -rf /var/lib/apt/lists/*

# Copy only package definitions first (ensures better Docker cache usage)
COPY package*.json ./

# 1) Install JS deps but SKIP all lifecycle scripts (avoids server postinstall running client build)
# 2) Then explicitly build/install sharp for Linux x64 (glibc) so the correct binary is used
#    - We re-enable scripts ONLY for the sharp install step.
#    - --build-from-source ensures native build if prebuilt cannot be fetched for this env.
RUN npm config set ignore-scripts true \
 && (npm ci || npm install --legacy-peer-deps) \
 && npm cache clean --force \
 && npm config set ignore-scripts false \
 && npm install --include=optional --force --platform=linux --arch=x64 --build-from-source sharp@0.34.2

# Copy the rest of the source (node_modules is excluded via .dockerignore)
COPY . .

# Runtime env
ENV NODE_ENV=production
EXPOSE 5000

# Healthcheck endpoint must exist in the app at /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:5000/health || exit 1

# Start app (NO nodemon here)
CMD ["node", "index.js"]

# --- REPLACE END ---
