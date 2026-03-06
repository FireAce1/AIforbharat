# KrishiAI Kubernetes Manifests

This directory contains Kubernetes manifests for deploying the KrishiAI platform to a Kubernetes cluster.

## Architecture Overview

The KrishiAI platform consists of the following components:

### Backend Services
- **auth-service** (Port 3000): User authentication and authorization
- **crop-service** (Port 8000): Crop recommendations and disease detection
- **market-service** (Port 3001): Market price intelligence and forecasting
- **climate-service** (Port 3002): Weather forecasts and water advisory
- **govt-service** (Port 3003): Government scheme discovery and chatbot

### Infrastructure
- **PostgreSQL with TimescaleDB**: Primary database for structured data
- **Redis**: Caching and session management

## Prerequisites

1. **Kubernetes Cluster**: GKE, EKS, or local cluster (minikube/kind)
2. **kubectl**: Configured to access your cluster
3. **Docker Images**: All service images built and pushed to registry

## Configuration Files

### Core Configuration
- `configmap.yaml`: Non-sensitive configuration (database hosts, ports, URLs)
- `secrets.yaml`: Sensitive data (passwords, API keys, tokens)

### Service Deployments
- `auth-service-deployment.yaml`: Auth service with HPA
- `crop-service-deployment.yaml`: Crop service with HPA
- `market-service-deployment.yaml`: Market service with HPA
- `climate-service-deployment.yaml`: Climate service with HPA
- `govt-service-deployment.yaml`: Government service with HPA

### Infrastructure
- `postgres-deployment.yaml`: PostgreSQL with TimescaleDB and persistent storage
- `redis-deployment.yaml`: Redis with persistent storage

### Networking
- `nginx-ingress.yaml`: Ingress controller for external access
- `tls-secret.yaml`: TLS certificates for HTTPS

## Deployment Instructions

### Step 1: Update Secrets

**IMPORTANT**: Before deploying, update `secrets.yaml` with production values:

```bash
# Edit secrets.yaml and replace all CHANGE_ME_IN_PRODUCTION values
kubectl apply -f secrets.yaml
```

Required secrets:
- `DB_PASSWORD`: Strong PostgreSQL password
- `REDIS_PASSWORD`: Strong Redis password
- `JWT_SECRET`: Strong JWT signing secret (32+ characters)
- `SMS_GATEWAY_API_KEY`: Twilio/MSG91 API key
- `IMD_API_KEY`: India Meteorological Department API key
- `ISRO_API_KEY`: ISRO MOSDAC API key
- `AGMARKNET_API_KEY`: Agmarknet API key
- `ENCRYPTION_KEY`: 32-byte AES-256 encryption key
- `SENTRY_DSN`: Sentry error tracking DSN
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: AWS credentials

### Step 2: Apply ConfigMap

```bash
kubectl apply -f configmap.yaml
```

### Step 3: Deploy Infrastructure

Deploy PostgreSQL and Redis first:

```bash
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis --timeout=300s
```

### Step 4: Run Database Migrations

```bash
# Port-forward to PostgreSQL
kubectl port-forward svc/postgres-service 5432:5432

# In another terminal, run migrations from each service
cd services/auth-service && npm run migrate
cd services/market-service && npm run migrate
cd services/climate-service && npm run migrate
cd services/govt-service && npm run migrate
```

### Step 5: Deploy Backend Services

```bash
kubectl apply -f auth-service-deployment.yaml
kubectl apply -f crop-service-deployment.yaml
kubectl apply -f market-service-deployment.yaml
kubectl apply -f climate-service-deployment.yaml
kubectl apply -f govt-service-deployment.yaml

# Wait for all services to be ready
kubectl wait --for=condition=ready pod -l tier=backend --timeout=300s
```

### Step 6: Deploy Ingress (Optional)

For external access with TLS:

```bash
# Update tls-secret.yaml with your certificates
kubectl apply -f tls-secret.yaml
kubectl apply -f nginx-ingress.yaml
```

## Verification

### Check Pod Status

```bash
kubectl get pods
```

Expected output:
```
NAME                              READY   STATUS    RESTARTS   AGE
auth-service-xxxxx                1/1     Running   0          2m
crop-service-xxxxx                1/1     Running   0          2m
market-service-xxxxx              1/1     Running   0          2m
climate-service-xxxxx             1/1     Running   0          2m
govt-service-xxxxx                1/1     Running   0          2m
postgres-xxxxx                    1/1     Running   0          5m
redis-xxxxx                       1/1     Running   0          5m
```

### Check Service Status

```bash
kubectl get services
```

### Check HPA Status

```bash
kubectl get hpa
```

Expected output:
```
NAME                  REFERENCE                    TARGETS   MINPODS   MAXPODS   REPLICAS
auth-service-hpa      Deployment/auth-service      45%/70%   3         10        3
crop-service-hpa      Deployment/crop-service      50%/70%   3         10        3
market-service-hpa    Deployment/market-service    40%/70%   3         10        3
climate-service-hpa   Deployment/climate-service   35%/70%   3         10        3
govt-service-hpa      Deployment/govt-service      30%/70%   3         10        3
```

### Test Health Endpoints

```bash
# Port-forward to test each service
kubectl port-forward svc/auth-service 3000:3000
curl http://localhost:3000/health

kubectl port-forward svc/crop-service 8000:8000
curl http://localhost:8000/health

kubectl port-forward svc/market-service 3001:3001
curl http://localhost:3001/health

kubectl port-forward svc/climate-service 3002:3002
curl http://localhost:3002/health

kubectl port-forward svc/govt-service 3003:3003
curl http://localhost:3003/health
```

## Resource Configuration

### Per Service
- **CPU Requests**: 250m (0.25 cores)
- **CPU Limits**: 500m (0.5 cores)
- **Memory Requests**: 256Mi
- **Memory Limits**: 512Mi
- **Replicas**: 3 (min) to 10 (max) with HPA

### Total Cluster Requirements (Minimum)
- **CPU**: ~4 cores (5 services × 3 replicas × 250m + infrastructure)
- **Memory**: ~8 GB (5 services × 3 replicas × 256Mi + infrastructure)
- **Storage**: 60 GB (50 GB PostgreSQL + 10 GB Redis)

### Recommended Production Cluster
- **Nodes**: 3-5 nodes
- **Node Size**: 4 vCPU, 16 GB RAM per node
- **Storage**: SSD-backed persistent volumes

## Auto-Scaling

All services are configured with Horizontal Pod Autoscaler (HPA):
- **Target CPU Utilization**: 70%
- **Target Memory Utilization**: 80%
- **Min Replicas**: 3
- **Max Replicas**: 10

HPA will automatically scale pods based on CPU and memory usage.

## Monitoring

### View Logs

```bash
# View logs for a specific service
kubectl logs -f deployment/auth-service
kubectl logs -f deployment/crop-service

# View logs for all pods with a label
kubectl logs -l tier=backend --tail=100
```

### View Metrics

```bash
# View resource usage
kubectl top pods
kubectl top nodes
```

### Access Prometheus Metrics

Each service exposes metrics at `/metrics` endpoint:

```bash
kubectl port-forward svc/auth-service 3000:3000
curl http://localhost:3000/metrics
```

## Troubleshooting

### Pod Not Starting

```bash
# Describe pod to see events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check if secrets/configmaps exist
kubectl get secrets
kubectl get configmaps
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints

# Check if pods are ready
kubectl get pods -l app=auth-service

# Test service connectivity from another pod
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
apk add curl
curl http://auth-service:3000/health
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
kubectl logs -l app=postgres

# Test database connection
kubectl exec -it <postgres-pod> -- psql -U krishiai_user -d krishiai_db -c "SELECT 1"

# Check if migrations ran
kubectl exec -it <postgres-pod> -- psql -U krishiai_user -d krishiai_db -c "\dt"
```

### High Memory/CPU Usage

```bash
# Check resource usage
kubectl top pods

# Check HPA status
kubectl get hpa

# Scale manually if needed
kubectl scale deployment auth-service --replicas=5
```

## Updating Deployments

### Update Service Image

```bash
# Update image version
kubectl set image deployment/auth-service auth-service=krishiai/auth-service:v1.2.0

# Check rollout status
kubectl rollout status deployment/auth-service

# Rollback if needed
kubectl rollout undo deployment/auth-service
```

### Update ConfigMap or Secrets

```bash
# Update configmap
kubectl apply -f configmap.yaml

# Restart deployments to pick up changes
kubectl rollout restart deployment/auth-service
kubectl rollout restart deployment/crop-service
kubectl rollout restart deployment/market-service
kubectl rollout restart deployment/climate-service
kubectl rollout restart deployment/govt-service
```

## Cleanup

To remove all resources:

```bash
# Delete all services
kubectl delete -f auth-service-deployment.yaml
kubectl delete -f crop-service-deployment.yaml
kubectl delete -f market-service-deployment.yaml
kubectl delete -f climate-service-deployment.yaml
kubectl delete -f govt-service-deployment.yaml

# Delete infrastructure
kubectl delete -f postgres-deployment.yaml
kubectl delete -f redis-deployment.yaml

# Delete configuration
kubectl delete -f configmap.yaml
kubectl delete -f secrets.yaml

# Delete ingress (if deployed)
kubectl delete -f nginx-ingress.yaml
kubectl delete -f tls-secret.yaml
```

## Security Best Practices

1. **Never commit secrets.yaml with real values to version control**
2. Use Kubernetes Secrets or external secret management (AWS Secrets Manager, HashiCorp Vault)
3. Enable RBAC and limit service account permissions
4. Use Network Policies to restrict pod-to-pod communication
5. Regularly update base images and scan for vulnerabilities
6. Enable Pod Security Policies or Pod Security Standards
7. Use TLS for all external communication
8. Rotate secrets regularly (every 90 days)

## Production Considerations

1. **High Availability**: Deploy across multiple availability zones
2. **Database Backups**: Set up automated PostgreSQL backups (see task 15.3)
3. **Disaster Recovery**: Configure cross-region replication (see task 15.4)
4. **Monitoring**: Deploy Prometheus and Grafana (see task 14.4)
5. **Logging**: Set up centralized logging with ELK stack
6. **CI/CD**: Automate deployments with GitHub Actions (see task 15.2)
7. **Resource Limits**: Adjust based on actual usage patterns
8. **Cost Optimization**: Use cluster autoscaler and right-size nodes

## Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/<service-name>`
- Check events: `kubectl get events --sort-by='.lastTimestamp'`
- Refer to service-specific documentation in `services/<service-name>/README.md`
