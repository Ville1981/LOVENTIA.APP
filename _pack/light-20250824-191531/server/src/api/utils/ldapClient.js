// src/api/utils/ldapClient.js

const ldap = require('ldapjs');

/**
 * Luo LDAP-clientin
 * @returns {import('ldapjs').Client}
 */
function createLdapClient() {
  return ldap.createClient({
    url: process.env.LDAP_URL,
    reconnect: true,
  });
}

/**
 * Authentikoi käyttäjä LDAP:ssä
 * @param {string} username LDAP-käyttäjätunnus
 * @param {string} password LDAP-salasana
 * @returns {Promise<boolean>} true jos onnistui
 */
function authenticateLdap(username, password) {
  const client = createLdapClient();
  const dn = `uid=${username},${process.env.LDAP_BASE_DN}`;
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      client.unbind();
      if (err) return reject(err);
      resolve(true);
    });
  });
}

module.exports = {
  createLdapClient,
  authenticateLdap,
};
