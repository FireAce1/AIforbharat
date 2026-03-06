/**
 * Swagger UI Setup for KrishiAI API Documentation
 * 
 * This script sets up Swagger UI to serve the OpenAPI specification
 * at the /api-docs endpoint.
 * 
 * Usage:
 *   npm install swagger-ui-express yamljs
 *   node swagger-ui-setup.js
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
const PORT = process.env.SWAGGER_PORT || 8080;

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));

// Swagger UI options
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'KrishiAI API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    requestSnippetsEnabled: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
};

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Serve raw OpenAPI spec
app.get('/openapi.yaml', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.yaml'));
});

app.get('/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'swagger-ui' });
});

// Redirect root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   KrishiAI API Documentation Server                      ║
║                                                           ║
║   Swagger UI: http://localhost:${PORT}/api-docs              ║
║   OpenAPI YAML: http://localhost:${PORT}/openapi.yaml        ║
║   OpenAPI JSON: http://localhost:${PORT}/openapi.json        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
