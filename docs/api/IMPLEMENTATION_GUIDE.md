# API Documentation Implementation Guide

## Overview

This guide explains how to set up and deploy the KrishiAI API documentation with Swagger UI.

## Prerequisites

- Node.js 16+ installed
- Access to the KrishiAI codebase
- Basic understanding of OpenAPI 3.0 specification

## Quick Start

### 1. Install Dependencies

```bash
cd docs/api
npm init -y
npm install express swagger-ui-express yamljs
```

### 2. Start Documentation Server

```bash
node swagger-ui-setup.js
```

The documentation will be available at:
- **Swagger UI**: http://localhost:8080/api-docs
- **OpenAPI YAML**: http://localhost:8080/openapi.yaml
- **OpenAPI JSON**: http://localhost:8080/openapi.json

### 3. Access Interactive Documentation

Open your browser and navigate to http://localhost:8080/api-docs

## Integration with Services

### Option 1: Standalone Documentation Server

Run the documentation server as a separate service:

```bash
# Development
node swagger-ui-setup.js

# Production (with PM2)
pm2 start swagger-ui-setup.js --name api-docs
```

### Option 2: Integrate with API Gateway

Add Swagger UI to your API Gateway (Kong/Nginx):

**Kong Configuration**:
```yaml
services:
  - name: api-docs
    url: http://localhost:8080
    routes:
      - name: api-docs-route
        paths:
          - /api-docs
```

**Nginx Configuration**:
```nginx
location /api-docs {
    proxy_pass http://localhost:8080/api-docs;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Option 3: Integrate with Each Service

Add Swagger UI to each microservice:

```javascript
// In each service's index.js
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const swaggerDocument = YAML.load('./docs/api/openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

## Docker Deployment

### Dockerfile

Create `docs/api/Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080

CMD ["node", "swagger-ui-setup.js"]
```

### Build and Run

```bash
# Build image
docker build -t krishiai/api-docs:latest docs/api/

# Run container
docker run -d -p 8080:8080 --name api-docs krishiai/api-docs:latest
```

### Docker Compose

Add to `docker-compose.yml`:

```yaml
services:
  api-docs:
    build: ./docs/api
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

## Kubernetes Deployment

### Deployment Manifest

Create `infrastructure/k8s/api-docs-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-docs
  labels:
    app: api-docs
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-docs
  template:
    metadata:
      labels:
        app: api-docs
    spec:
      containers:
      - name: api-docs
        image: krishiai/api-docs:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: api-docs
spec:
  selector:
    app: api-docs
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-docs
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.krishiai.com
    secretName: api-docs-tls
  rules:
  - host: api.krishiai.com
    http:
      paths:
      - path: /api-docs
        pathType: Prefix
        backend:
          service:
            name: api-docs
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
kubectl apply -f infrastructure/k8s/api-docs-deployment.yaml
kubectl rollout status deployment/api-docs
```

## Updating Documentation

### 1. Edit OpenAPI Specification

Edit `docs/api/openapi.yaml` to add or modify endpoints:

```yaml
paths:
  /new-endpoint:
    get:
      tags:
        - New Feature
      summary: Description
      # ... rest of endpoint definition
```

### 2. Validate Specification

Use Swagger Editor or CLI tools to validate:

```bash
# Install swagger-cli
npm install -g @apidevtools/swagger-cli

# Validate
swagger-cli validate docs/api/openapi.yaml
```

### 3. Restart Documentation Server

```bash
# Development
# Server auto-reloads with nodemon
npm install -g nodemon
nodemon swagger-ui-setup.js

# Production
pm2 restart api-docs

# Docker
docker restart api-docs

# Kubernetes
kubectl rollout restart deployment/api-docs
```

## Customization

### Custom Branding

Edit `swagger-ui-setup.js` to customize appearance:

```javascript
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { 
      background-color: #2E7D32; 
    }
    .swagger-ui .info .title {
      color: #2E7D32;
    }
  `,
  customSiteTitle: 'KrishiAI API Documentation',
  customfavIcon: '/favicon.ico'
};
```

### Add Custom Logo

```javascript
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar-wrapper img {
      content: url('/logo.png');
    }
  `
};
```

### Enable Authentication

Add authentication UI for testing:

```javascript
const swaggerOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    authAction: {
      BearerAuth: {
        name: 'BearerAuth',
        schema: {
          type: 'http',
          in: 'header',
          name: 'Authorization',
          description: 'JWT token'
        },
        value: 'Bearer <your-token-here>'
      }
    }
  }
};
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/deploy-api-docs.yml`:

```yaml
name: Deploy API Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/api/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate OpenAPI Spec
        run: |
          npm install -g @apidevtools/swagger-cli
          swagger-cli validate docs/api/openapi.yaml
      
      - name: Build Docker Image
        run: |
          docker build -t krishiai/api-docs:${{ github.sha }} docs/api/
          docker tag krishiai/api-docs:${{ github.sha }} krishiai/api-docs:latest
      
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push krishiai/api-docs:${{ github.sha }}
          docker push krishiai/api-docs:latest
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/api-docs api-docs=krishiai/api-docs:${{ github.sha }}
          kubectl rollout status deployment/api-docs
```

## Monitoring

### Health Checks

The documentation server includes a health check endpoint:

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "service": "swagger-ui"
}
```

### Prometheus Metrics

Add metrics collection (optional):

```javascript
const promClient = require('prom-client');

const register = new promClient.Registry();
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Troubleshooting

### Issue: YAML Parse Error

**Solution**: Validate YAML syntax
```bash
swagger-cli validate docs/api/openapi.yaml
```

### Issue: Port Already in Use

**Solution**: Change port or kill existing process
```bash
# Change port
SWAGGER_PORT=8081 node swagger-ui-setup.js

# Or kill existing process
lsof -ti:8080 | xargs kill -9
```

### Issue: Documentation Not Updating

**Solution**: Clear browser cache or use incognito mode

### Issue: Authentication Not Working

**Solution**: Ensure JWT token is valid and includes "Bearer " prefix

## Best Practices

1. **Keep OpenAPI spec in sync**: Update documentation when API changes
2. **Validate before commit**: Use pre-commit hooks to validate spec
3. **Version documentation**: Tag releases with version numbers
4. **Include examples**: Add request/response examples for all endpoints
5. **Document errors**: Include all possible error responses
6. **Test endpoints**: Use "Try it out" feature to test endpoints
7. **Monitor usage**: Track documentation access and popular endpoints

## Support

For documentation issues:
- GitHub Issues: https://github.com/krishiai/platform/issues
- Email: api-support@krishiai.com
- Slack: #api-docs channel
