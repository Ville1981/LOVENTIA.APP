# server/Dockerfile

# 1) Build-vaihe (TypeScript/moderni JS)
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Kopioidaan vain pakettilistat ja tsconfig, asennetaan dev-riippuvuudet
COPY package*.json tsconfig*.json ./
RUN npm ci

# Kopioidaan lähdekoodi ja käännetään
COPY . .
RUN npm run build

# 2) Runtime-vaihe
FROM node:18-alpine
WORKDIR /usr/src/app

# Kopioidaan tuotantorakenne ja pakettitiedostot
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

# Asennetaan vain production-riippuvuudet
RUN npm ci --only=production

# Ympäristömuuttuja ja portti
ENV NODE_ENV=production
EXPOSE 5000

# Käynnistyskomento
CMD ["node", "dist/index.js"]


