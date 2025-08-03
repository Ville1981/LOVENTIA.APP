// src/monitoring/apmTracer.js

import apm from 'elastic-apm-node';

// APM initialization (Elastic APM)
apm.start({
  serviceName: process.env.APM_SERVICE_NAME || 'my-app',
  serverUrl: process.env.APM_SERVER_URL,
  environment: process.env.NODE_ENV || 'development'
});

export default apm;