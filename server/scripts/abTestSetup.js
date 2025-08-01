// scripts/abTestSetup.js

const fs = require('fs');
const path = require('path');

/**
 * Luo A/B-testiryhmät ja tallentaa jaotuksen tiedostoon
 * @param {string} experimentName
 * @param {number} variantCount
 */
function setupAbTest(experimentName, variantCount) {
  const assignments = {};
  for (let i = 0; i < variantCount; i++) {
    assignments[`variant_${i}`] = [];
  }

  // Esimerkki: jaetaan käyttäjät ID:n mukaan modulo-variantCount
  const users = require('../data/users.json');
  users.forEach(user => {
    const idx = user.id % variantCount;
    assignments[`variant_${idx}`].push(user.id);
  });

  const outputPath = path.join(__dirname, '../data/abAssignments.json');
  fs.writeFileSync(outputPath, JSON.stringify({ experimentName, assignments }, null, 2));
  console.log(`A/B test setup written to ${outputPath}`);
}

// CLI-käyttö
if (require.main === module) {
  const [,, experiment, count] = process.argv;
  if (!experiment || !count) {
    console.error('Usage: node abTestSetup.js <experimentName> <variantCount>');
    process.exit(1);
  }
  setupAbTest(experiment, parseInt(count, 10));
}
