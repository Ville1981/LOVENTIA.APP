// src/monitoring/slaChecker.js

const axios = require('axios');

/**
 * Tarkistaa SLA:n toteutumisen kutsumalla sisäisen terveysendpointin
 * @returns {Promise<{ uptime: number, errorRate: number }>}
 */
async function checkSLA() {
  try {
    const res = await axios.get(process.env.SLA_ENDPOINT);
    const { uptime, errorRate } = res.data;

    if (errorRate > 0.05) {
      console.warn(`SLA breach: errorRate=${errorRate}`);
    }
    if (uptime < 99.9) {
      console.warn(`SLA breach: uptime=${uptime}`);
    }

    return { uptime, errorRate };
  } catch (err) {
    console.error('SLA check failed:', err);
    throw err;
  }
}

// Jos tämä tiedosto suoritetaan suoraan, käynnistä ajoitettu tarkistus
if (require.main === module) {
  setInterval(() => {
    checkSLA().catch(() => {
      // virhe on jo lokattu
    });
  }, 5 * 60 * 1000); // 5 min välein
}

module.exports = { checkSLA };
