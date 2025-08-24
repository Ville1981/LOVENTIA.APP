// --- REPLACE START: convert ESM to CommonJS; keep logic intact ---
'use strict';

const apm = require('elastic-apm-node');

// APM initialization (Elastic APM)
apm.start({
  serviceName: process.env.APM_SERVICE_NAME || 'my-app',
  serverUrl: process.env.APM_SERVER_URL,
  environment: process.env.NODE_ENV || 'development',
});

module.exports = apm;
// --- REPLACE END ---
