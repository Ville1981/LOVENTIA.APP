// config/database.multi.region.js

/**
 * Database connection config for primary and replica regions.
 * Sovellus käyttää näitä asetuksia valitakseen lähimmän tai ensisijaisen DB-instanssin.
 */

const regions = {
  primary: {
    host: process.env.DB_PRIMARY_HOST || 'db-primary.example.com',
    port: process.env.DB_PRIMARY_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  replicas: [
    {
      region: 'eu-west-1',
      host: process.env.DB_EU_HOST || 'db-eu.example.com',
    },
    {
      region: 'us-east-1',
      host: process.env.DB_US_HOST || 'db-us.example.com',
    }
  ]
};

/**
 * Hakee parhaan DB-yhteyden maantieteellisen sijainnin mukaan
 */
export function getDbConfig(userRegion) {
  const replica = regions.replicas.find(r => r.region === userRegion);
  if (replica) {
    return {
      host: replica.host,
      port: regions.primary.port,
      user: regions.primary.user,
      password: regions.primary.password,
      database: regions.primary.database,
    };
  }
  return regions.primary;
}