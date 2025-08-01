const path       = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML       = require('yamljs');

// Load the OpenAPI document (YAML) from the server root
const swaggerDocument = YAML.load(
  path.join(__dirname, '../openapi.yaml')
);

// Export middleware for serving Swagger UI
module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(swaggerDocument),
};
