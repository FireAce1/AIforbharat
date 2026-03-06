# Load Testing with k6

This directory contains k6 load test scripts for the KrishiAI MVP platform.

## Prerequisites

Install k6:
```bash
# Windows (using Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Scenarios

### 1. Authentication Service Load Test
Tests OTP generation, verification, and JWT token operations.
```bash
k6 run auth-load-test.js
```

### 2. Crop Service Load Test
Tests crop recommendations and disease detection endpoints.
```bash
k6 run crop-load-test.js
```

### 3. Market Service Load Test
Tests price queries, forecasts, and alert operations.
```bash
k6 run market-load-test.js
```

### 4. Climate Service Load Test
Tests weather forecasts and water advisory endpoints.
```bash
k6 run climate-load-test.js
```

### 5. Government Service Load Test
Tests scheme search and chatbot query endpoints.
```bash
k6 run govt-load-test.js
```

### 6. Full System Load Test
Runs all endpoints simultaneously with realistic user behavior.
```bash
k6 run full-system-load-test.js
```

## Test Configuration

All tests are configured to:
- **Duration**: 10 minutes
- **Concurrent Users**: 1,000 virtual users (VUs)
- **Ramp-up**: 2 minutes to reach 1,000 VUs
- **Steady State**: 6 minutes at 1,000 VUs
- **Ramp-down**: 2 minutes to 0 VUs

## Success Criteria

- ✅ p95 latency < 500ms
- ✅ Error rate < 1%
- ✅ System handles 100K database records
- ✅ Auto-scaling: pods scale from 3 to 10 under load
- ✅ No memory leaks or resource exhaustion

## Monitoring During Tests

Monitor the following during load tests:

1. **Kubernetes Pods**:
```bash
watch kubectl get pods -n krishiai
```

2. **Horizontal Pod Autoscaler**:
```bash
watch kubectl get hpa -n krishiai
```

3. **Resource Usage**:
```bash
kubectl top pods -n krishiai
```

4. **Prometheus Metrics**:
Open Grafana dashboards at http://localhost:3000

## Generating Reports

After running tests, generate HTML reports:
```bash
k6 run --out json=results.json full-system-load-test.js
k6-reporter results.json --output report.html
```

## Database Seeding

Before running load tests, seed the database with 100K records:
```bash
node seed-database.js
```

## Troubleshooting

### High Error Rates
- Check service logs: `kubectl logs -f deployment/service-name -n krishiai`
- Verify database connections
- Check Redis cache availability

### Slow Response Times
- Monitor database query performance
- Check cache hit rates
- Verify network latency

### Auto-scaling Not Triggering
- Verify HPA configuration: `kubectl describe hpa -n krishiai`
- Check metrics-server: `kubectl get apiservice v1beta1.metrics.k8s.io`
- Ensure CPU/memory targets are set correctly
