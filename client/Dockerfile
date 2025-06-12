# 1) Build-vaihe
FROM node:18-alpine as build
WORKDIR /app

# Kopioidaan riippuvuustiedostot ja asennetaan
COPY package*.json ./
RUN npm install

# Kopioidaan lähdekoodi ja rakennetaan tuotantoversio
COPY . .
RUN npm run build


# 2) Käyttövaihe nginx:llä
FROM nginx:alpine

# Poistetaan oletussivusto
RUN rm -rf /usr/share/nginx/html/*

# Kopioidaan build-kansio nginxin palvelemaan hakemistoon
COPY --from=build /app/dist /usr/share/nginx/html

# Oma nginx-konfiguraatio API-proxyllä
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]



