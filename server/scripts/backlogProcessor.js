// scripts/backlogProcessor.js

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { calculatePriority } = require('../src/utils/prioritization.js');

/**
 * Prosessoi käyttäjäpalautteet CSV- tai JSON-tiedostosta ja laskee prioriteettipisteet.
 * @param {string} inputPath Polku CSV- tai JSON-tiedostoon
 * @param {string} outputPath Polku, johon tulos tallennetaan
 */
function processBacklog(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  let itemsPromise;

  if (ext === '.csv') {
    itemsPromise = new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(inputPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  } else {
    itemsPromise = Promise.resolve(JSON.parse(fs.readFileSync(inputPath, 'utf-8')));
  }

  itemsPromise
    .then((items) => {
      const prioritized = items.map((item) => ({
        ...item,
        priority: calculatePriority(Number(item.impact), Number(item.effort)),
      }));
      fs.writeFileSync(outputPath, JSON.stringify(prioritized, null, 2));
      console.log(`Backlog processed. Results saved to ${outputPath}`);
    })
    .catch((err) => console.error('Error processing backlog:', err));
}

// CLI
if (require.main === module) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error('Usage: node backlogProcessor.js <inputPath> <outputPath>');
    process.exit(1);
  }
  processBacklog(input, output);
}
