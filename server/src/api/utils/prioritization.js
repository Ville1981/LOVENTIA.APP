// src/utils/prioritization.js

/**
 * Laskee prioriteettipisteen impact × effort -mallilla
 * @param {number} impact     Käyttäjäpalautteen vaikutus (1-10)
 * @param {number} effort     Arvioitu työmäärä (1-10)
 * @returns {number}          Prioriteettipistemäärä
 */
export function calculatePriority(impact, effort) {
  if (effort <= 0) return Infinity; // ei saa jakaa nollalla
  return impact / effort;
}
