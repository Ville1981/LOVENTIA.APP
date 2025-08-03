// src/utils/abTest.js

const fs = require('fs');
const path = require('path');

/**
 * Hakee A/B-testin jaotukset JSON-tiedostosta
 */
function loadAssignments(experimentName) {
  const file = path.join(__dirname, '../../data/abAssignments.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (data.experimentName !== experimentName) {
    throw new Error('Experiment not found');
  }
  return data.assignments;
}

/**
 * Määrittää käyttäjän variantin ja palauttaa sen
 */
function getUserVariant(experimentName, userId) {
  const assignments = loadAssignments(experimentName);
  for (const [variant, users] of Object.entries(assignments)) {
    if (users.includes(userId)) {
      return variant;
    }
  }
  // Fallback: satunnainen jakautuma
  const variants = Object.keys(assignments);
  return variants[userId % variants.length];
}

module.exports = {
  loadAssignments,
  getUserVariant,
};
