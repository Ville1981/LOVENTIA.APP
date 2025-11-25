// client/src/api/account.js

// HUOM: säädä tämä importti sen mukaan, mikä teillä on keskitetty axios-instanssi.
// Monessa Loventia-vaiheessa on käytetty esim. `apiClient` tai `axiosInstance`.
// Jos sinulla on jo esim. `client/src/api/client.js`, muuta importti vastaamaan sitä.

import apiClient from './client'; // ← TEE TARVITTAESSA MUUTOS TÄHÄN

/**
 * DELETE /api/users/me
 *
 * Poistaa kirjautuneen käyttäjän tilin.
 * Backend vastaa 204 No Content onnistuessaan.
 */
export async function deleteAccount() {
  await apiClient.delete('/api/users/me');
}
