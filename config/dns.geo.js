// config/dns.geo.js

/**
 * Geo-DNS routing config
 * Palauttaa API-päätepisteen käyttäjän maantieteellisen sijainnin perusteella.
 */

const endpoints = {
  eu: 'https://eu.api.example.com',
  us: 'https://us.api.example.com',
  ap: 'https://ap.api.example.com',
  default: 'https://api.example.com',
};

/**
 * Valitsee endpointin GeoIP-alueen perusteella
 * @param {{ countryCode: string }} geoInfo
 */
export function getApiEndpoint(geoInfo) {
  const prefix = geoInfo.countryCode.toLowerCase();
  if (prefix.startsWith('eu')) return endpoints.eu;
  if (prefix === 'us') return endpoints.us;
  if (['au', 'jp', 'sg'].includes(prefix)) return endpoints.ap;
  return endpoints.default;
}
