# Käytetään kevyttä Node-alpine -kuvaa
FROM node:18-alpine

# Työhakemisto
WORKDIR /usr/src/app

# Kopioidaan riippuvuustiedostot ja asennetaan tuotantoriippuvuudet
COPY package*.json ./
RUN npm install --only=production

# Kopioidaan muu sovelluskoodi
COPY . .

# Luodaan hakemisto latauksille
RUN mkdir -p uploads uploads/profiles

# Expose port
EXPOSE 5000

# Käynnistyskomento
CMD ["npm", "start"]