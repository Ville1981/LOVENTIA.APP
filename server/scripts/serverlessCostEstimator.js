/ scripts/serverlessCostEstimator.js

const AWS = require('aws-sdk');

/**
 * Arvioi Lambda-funktioiden kulutuksen kuukausitasolla
 * @param {string} region AWS-alue
 * @param {number} invocations Kuukausittaiset kutsumäärät
 * @param {number} avgDuration Keskimääräinen ajoaika ms
 */
async function estimateLambdaCost(region, invocations, avgDuration) {
  const pricing = new AWS.Pricing({ region: 'us-east-1' });
  // Hae hinnat lambda-invocation ja compute
  // Placeholder: kovakoodatut hinnat
  const computePricePerGBs = 0.00001667; // USD per GB-s
  const requestPricePerMillion = 0.20;    // USD per miljoona

  const gbSeconds = invocations * (avgDuration / 1000) * (128 / 1024);
  const cost = gbSeconds * computePricePerGBs + (invocations / 1000000) * requestPricePerMillion;
  console.log(`Estimated monthly Lambda cost: $${cost.toFixed(2)}`);
}

// Esimerkki-ajokutsu
estimateLambdaCost('us-east-1', 1000000, 200);