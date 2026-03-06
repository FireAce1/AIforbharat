# KrishiAI Monitoring Module

Shared Prometheus metrics module for all KrishiAI services.

## Overview

This module provides standardized Prometheus metrics collection across all KrishiAI microservices. It includes automatic HTTP request tracking, ML model performance metrics, and business KPI metrics.

## Installation

This module is part of the `@krishiai/shared` package. Services should install it as a dependency:

```json
{
  "dependencies": {
    "@krishiai/shared": "file:../shared",
    "prom-client": "^15.1.0"
  }
}
```

## Usage

### Basic Setup (Node.js/Express)

```typescript
import express from 'express';
import { register, createMetricsMiddleware } from '@krishiai/shared/monitoring';

const app = express();

// Add metrics middleware (automatically tracks all HTTP requests)
app.use(createMetricsMiddleware('your-service-name'));

// Your routes here
app.use('/api/v1', routes);

// Expose metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(3000);
```

### Recording Custom Metrics

#### HTTP Requests (Manual)

```typescript
import { recordHttpRequest } from '@krishiai/shared/monitoring';

// Manually record HTTP request (usually not needed with middleware)
recordHttpRequest('GET', '/api/v1/users', 200, 0.123, 'auth-service');
```

#### ML Model Metrics

```typescript
import { 
  recordModelInference, 
  updateModelAccuracy 
} from '@krishiai/shared/monitoring';

// Record model inference
const startTime = Date.now();
const result = await model.predict(input);
const latency = (Date.now() - startTime) / 1000;

recordModelInference('disease_detector', '1.0', latency, 'crop-service');

// Update model accuracy (periodically)
updateModelAccuracy('disease_detector', '1.0', 0.92, 'crop-service');
```

#### Business Metrics

```typescript
import {
  recordDiseaseDetection,
  recordCropRecommendation,
  recordMarketPriceQuery,
  recordWeatherForecastQuery,
  recordSchemeQuery,
  recordChatbotQuery,
  updateActiveUsers
} from '@krishiai/shared/monitoring';

// Record disease detection
recordDiseaseDetection('tomato', 'early_blight', 0.95, 'crop-service');

// Record crop recommendation
recordCropRecommendation('wheat', 0.88, 'crop-service');

// Record market price query
recordMarketPriceQuery('onion', 'forecast', 'market-service');

// Record weather forecast query
recordWeatherForecastQuery(7, 'climate-service');

// Record government scheme query
recordSchemeQuery('PM-KISAN', true, 'govt-service');

// Record chatbot query
recordChatbotQuery('weather_query', 0.92, 'hi', 'govt-service');

// Update active users count
updateActiveUsers('daily', 1250, 'auth-service');
```

## Available Metrics

### HTTP Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `http_request_duration_seconds` | Histogram | HTTP request duration | method, route, status_code, service |
| `http_requests_total` | Counter | Total HTTP requests | method, route, status_code, service |

### ML Model Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `model_inference_latency_seconds` | Histogram | Model inference latency | model_name, model_version, service |
| `model_accuracy` | Gauge | Model prediction accuracy | model_name, model_version, service |

### Business Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `active_users` | Gauge | Active users count | time_window, service |
| `disease_detections_total` | Counter | Disease detections performed | crop_type, disease_name, confidence_level, service |
| `crop_recommendations_total` | Counter | Crop recommendations generated | recommended_crop, confidence_level, service |
| `market_price_queries_total` | Counter | Market price queries | crop_name, query_type, service |
| `weather_forecast_queries_total` | Counter | Weather forecast queries | forecast_days, service |
| `scheme_queries_total` | Counter | Government scheme queries | scheme_type, eligible, service |
| `chatbot_queries_total` | Counter | Chatbot queries | intent, confidence_level, language, service |

## Confidence Levels

Confidence scores are automatically categorized:
- **high**: ≥ 0.9
- **medium**: 0.7 - 0.89
- **low**: < 0.7

## Histogram Buckets

### HTTP Request Duration
Buckets: `[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]` seconds

Optimized for API response times (1ms to 5s).

### Model Inference Latency
Buckets: `[0.1, 0.25, 0.5, 1, 2, 5, 10]` seconds

Optimized for ML model inference times (100ms to 10s).

## Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'krishiai-services'
    scrape_interval: 15s
    static_configs:
      - targets:
          - 'auth-service:3001'
          - 'crop-service:3002'
          - 'market-service:3003'
          - 'climate-service:3004'
          - 'govt-service:3005'
    metrics_path: '/metrics'
```

## Grafana Queries

### API Performance

```promql
# Average response time
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Request rate
sum(rate(http_requests_total[5m])) by (service)

# Error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### ML Model Performance

```promql
# Average inference latency
rate(model_inference_latency_seconds_sum[5m]) / rate(model_inference_latency_seconds_count[5m])

# Model accuracy
model_accuracy

# Inference rate
rate(model_inference_latency_seconds_count[5m])
```

### Business Metrics

```promql
# Disease detections per hour
rate(disease_detections_total[1h]) * 3600

# Crop recommendations per hour
rate(crop_recommendations_total[1h]) * 3600

# Daily active users
active_users{time_window="daily"}

# Most common diseases detected
topk(10, sum(rate(disease_detections_total[24h])) by (disease_name))

# Most recommended crops
topk(10, sum(rate(crop_recommendations_total[24h])) by (recommended_crop))
```

## Testing

Test metrics endpoint:

```bash
# Start a service
cd services/auth-service
npm run dev

# In another terminal, check metrics
curl http://localhost:3001/metrics

# Generate some traffic
curl http://localhost:3001/api/v1/auth/health

# Check metrics again
curl http://localhost:3001/metrics | grep http_requests_total
```

## Default Metrics

The module automatically collects default Node.js metrics:
- Process CPU usage
- Process memory usage
- Event loop lag
- Active handles
- Garbage collection stats

## Best Practices

1. **Use middleware**: Let the middleware automatically track HTTP requests
2. **Record business events**: Always record important business events (detections, recommendations)
3. **Update gauges periodically**: Update active users and accuracy metrics on a schedule
4. **Use consistent labels**: Always include service name in labels
5. **Don't over-label**: Avoid high-cardinality labels (like user IDs)
6. **Monitor performance**: Keep an eye on metrics collection overhead

## Troubleshooting

### Metrics not appearing

1. Check that middleware is added before routes
2. Verify `/metrics` endpoint is accessible
3. Check service name is correct
4. Ensure prom-client is installed

### High memory usage

1. Reduce histogram bucket count
2. Limit label cardinality
3. Increase Prometheus scrape interval

### Missing business metrics

1. Verify helper functions are called
2. Check label values are correct
3. Ensure metrics are registered

## API Reference

See [metrics.ts](./metrics.ts) for complete API documentation.

## Related Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client Documentation](https://github.com/siimon/prom-client)
- [Grafana Documentation](https://grafana.com/docs/)

## Support

For issues or questions, contact the KrishiAI DevOps team.
