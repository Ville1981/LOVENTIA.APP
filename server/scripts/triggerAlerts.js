// server/scripts/triggerAlerts.js

// Simulate threshold breaches to test alertRules notifications

// Load environment variables
require('dotenv').config();

// Import the checkThreshold helper
const { checkThreshold } = require('../src/utils/alertRules');

/**
 * Run simulated alerts for Error Rate, Latency, and Throughput.
 */
async function run() {
  // Simulate an extremely high error rate
  await checkThreshold(
    'Error Rate',
    99, // currentValue
    Number(process.env.ERROR_RATE_THRESHOLD)
  );

  // Simulate very high latency
  await checkThreshold(
    'Latency',
    9999, // currentValue in ms
    Number(process.env.LATENCY_THRESHOLD_MS)
  );

  // Simulate zero throughput
  await checkThreshold(
    'Throughput',
    0, // currentValue
    Number(process.env.THROUGHPUT_THRESHOLD_RPM)
  );

  console.log('TriggerAlerts script executed. Check your Slack and Email notifications.');
}

// Execute the script
run().catch((err) => {
  console.error('Error running triggerAlerts:', err);
  process.exit(1);
});
