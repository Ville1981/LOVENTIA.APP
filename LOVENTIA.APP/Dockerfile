# client/Dockerfile
# 1) Build-vaihe
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json vite.config.* ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime-vaihe nginx:llä
FROM nginx:alpine

# Poista oletussisältö ja kopioi build-hakemisto
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html

# Oma nginx-konfiguraatio
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]