# CI/CD Pipeline Documentation

## Overview

This directory contains GitHub Actions workflows for continuous integration and deployment of the KrishiAI platform.

## Workflows

### 1. CI - Continuous Integration (`ci.yml`)

**Trigger**: Every push and pull request to `main`, `develop`, and `feature/**` branches

**Purpose**: Automated testing and validation

**Jobs**:
- **Lint**: Code quality checks with ESLint and Prettier
- **Test Node.js Services**: Unit and integration tests for all Node.js microservices
- **Test Python Services**: Unit and integration tests for Python services (crop-service)
- **Test Mobile App**: React Native mobile app tests
- **Build Images**: Docker image builds for all services
- **Security Scan**: Trivy vulnerability scanning for Docker images
- **All Tests Passed**: Gate that ensures all tests pass before deployment

**Services Used**:
- PostgreSQL (TimescaleDB) for database tests
- Redis for caching tests

**Coverage**: Uploads test coverage to Codecov

### 2. Deploy to Staging (`deploy-staging.yml`)

**Trigger**: Push to `develop` branch or manual workflow dispatch

**Purpose**: Automated deployment to staging environment

**Jobs**:
1. **CI Tests**: Runs full CI pipeline first
2. **Build and Push**: Builds and pushes Docker images to GitHub Container Registry
3. **Deploy Staging**: Deploys to staging Kubernetes cluster
4. **Smoke Tests**: Validates deployment with health checks and basic API tests
5. **Notify**: Sends Slack notification with deployment status

**Environment**: `staging` (https://staging.krishiai.com)

**Deployment Strategy**: Standard rolling update

### 3. Deploy to Production (`deploy-production.yml`)

**Trigger**: Push to `main` branch or manual workflow dispatch

**Purpose**: Automated deployment to production with gradual rollout

**Jobs**:
1. **CI Tests**: Runs full CI pipeline first (can be skipped with manual trigger)
2. **Build and Push**: Builds and pushes Docker images with `latest` and `prod-*` tags
3. **Deploy 10% Traffic**: Initial deployment to 10% of pods, monitors for 5 minutes
4. **Deploy 50% Traffic**: Scales to 50% of pods, monitors for 5 minutes
5. **Deploy 100% Traffic**: Completes rollout to all pods, monitors for 10 minutes
6. **Smoke Tests**: Validates deployment with comprehensive health checks
7. **Rollback**: Automatically rolls back on any failure
8. **Notify**: Sends Slack and email notifications

**Environment**: `production` (https://krishiai.com)

**Deployment Strategy**: Gradual rollout (10% → 50% → 100%)

**Rollback**: Automatic rollback using `kubectl rollout undo` on failure

## Gradual Rollout Strategy

The production deployment implements a gradual rollout strategy to minimize risk:

1. **10% Traffic** (5 min monitoring)
   - Deploys new version to ~10% of pods
   - Monitors error rates and health
   - Fails fast if issues detected

2. **50% Traffic** (5 min monitoring)
   - Scales to 50% of pods
   - Continues monitoring
   - Allows comparison between old and new versions

3. **100% Traffic** (10 min monitoring)
   - Completes rollout to all pods
   - Final validation
   - Extended monitoring period

**Total Deployment Time**: ~20-30 minutes for full rollout

## Security Scanning

All Docker images are scanned with Trivy for vulnerabilities:
- **Severity Levels**: CRITICAL and HIGH
- **Action**: Fails build on CRITICAL vulnerabilities
- **Results**: Uploaded to GitHub Security tab

## Secrets Required

### Staging Environment
- `KUBE_CONFIG_STAGING`: Kubernetes config for staging cluster
- `STAGING_DATABASE_URL`: PostgreSQL connection string
- `STAGING_REDIS_URL`: Redis connection string
- `STAGING_JWT_SECRET`: JWT signing secret
- `STAGING_SMS_API_KEY`: SMS gateway API key
- `STAGING_IMD_API_KEY`: IMD weather API key
- `STAGING_SENTRY_DSN`: Sentry error tracking DSN

### Production Environment
- `KUBE_CONFIG_PRODUCTION`: Kubernetes config for production cluster
- `PRODUCTION_DATABASE_URL`: PostgreSQL connection string
- `PRODUCTION_REDIS_URL`: Redis connection string
- `PRODUCTION_JWT_SECRET`: JWT signing secret
- `PRODUCTION_SMS_API_KEY`: SMS gateway API key
- `PRODUCTION_IMD_API_KEY`: IMD weather API key
- `PRODUCTION_SENTRY_DSN`: Sentry error tracking DSN

### Notifications
- `SLACK_WEBHOOK_URL`: Slack webhook for deployment notifications
- `EMAIL_USERNAME`: SMTP username for email notifications
- `EMAIL_PASSWORD`: SMTP password for email notifications
- `ALERT_EMAIL`: Email address for critical alerts

## Notifications

### Slack Notifications
All deployments send rich Slack notifications with:
- Deployment status (success/failure/rolled back)
- Environment (staging/production)
- Branch and commit information
- Author information
- Direct links to workflow and deployment

### Email Notifications
Production failures trigger email alerts to the operations team.

## Manual Deployment

### Staging
```bash
# Trigger staging deployment manually
gh workflow run deploy-staging.yml
```

### Production
```bash
# Trigger production deployment manually
gh workflow run deploy-production.yml

# Skip CI tests (not recommended)
gh workflow run deploy-production.yml -f skip_tests=true
```

## Rollback

### Automatic Rollback
Production deployments automatically roll back on failure using `kubectl rollout undo`.

### Manual Rollback
```bash
# Configure kubectl for production
export KUBECONFIG=/path/to/production-kubeconfig

# Rollback specific service
kubectl rollout undo deployment/auth-service -n production
kubectl rollout undo deployment/crop-service -n production
kubectl rollout undo deployment/market-service -n production
kubectl rollout undo deployment/climate-service -n production
kubectl rollout undo deployment/govt-service -n production

# Verify rollback
kubectl rollout status deployment/auth-service -n production
```

## Monitoring Deployments

### View Deployment Status
```bash
# Watch deployment progress
kubectl rollout status deployment/auth-service -n production

# View pod status
kubectl get pods -n production

# View deployment history
kubectl rollout history deployment/auth-service -n production
```

### View Logs
```bash
# View logs for specific service
kubectl logs -f deployment/auth-service -n production

# View logs for specific pod
kubectl logs -f <pod-name> -n production
```

### Check Health
```bash
# Test health endpoints
curl https://krishiai.com/api/v1/auth-service/health
curl https://krishiai.com/api/v1/crop-service/health
curl https://krishiai.com/api/v1/market-service/health
curl https://krishiai.com/api/v1/climate-service/health
curl https://krishiai.com/api/v1/govt-service/health
```

## Troubleshooting

### Deployment Stuck
```bash
# Check pod status
kubectl get pods -n production

# Describe pod for events
kubectl describe pod <pod-name> -n production

# Check deployment events
kubectl describe deployment <service-name> -n production
```

### Image Pull Errors
```bash
# Verify image exists
docker pull ghcr.io/<org>/<repo>/<service>:<tag>

# Check image pull secrets
kubectl get secrets -n production
kubectl describe secret krishiai-secrets -n production
```

### Health Check Failures
```bash
# Check service logs
kubectl logs -f deployment/<service-name> -n production

# Test health endpoint directly from pod
kubectl exec -it <pod-name> -n production -- curl localhost:3000/health
```

### Rollback Issues
```bash
# View rollout history
kubectl rollout history deployment/<service-name> -n production

# Rollback to specific revision
kubectl rollout undo deployment/<service-name> --to-revision=<revision> -n production
```

## Best Practices

1. **Always run CI tests**: Don't skip tests in production deployments
2. **Monitor during rollout**: Watch metrics and logs during gradual rollout
3. **Test in staging first**: Deploy to staging before production
4. **Use feature flags**: For risky changes, use feature flags to control rollout
5. **Keep rollback ready**: Ensure previous version is always available for rollback
6. **Document changes**: Include clear commit messages and PR descriptions
7. **Coordinate deployments**: Notify team before production deployments
8. **Monitor post-deployment**: Watch metrics for at least 30 minutes after deployment

## Performance Metrics

### CI Pipeline
- **Average Duration**: 10-15 minutes
- **Test Coverage**: >70% target
- **Parallel Jobs**: 5+ concurrent jobs

### Staging Deployment
- **Average Duration**: 5-10 minutes
- **Downtime**: Zero (rolling update)

### Production Deployment
- **Average Duration**: 20-30 minutes (with gradual rollout)
- **Downtime**: Zero (rolling update)
- **Rollback Time**: <5 minutes

## Support

For issues with CI/CD pipelines:
1. Check workflow logs in GitHub Actions
2. Review Kubernetes events and logs
3. Check Slack notifications for error details
4. Contact DevOps team via Slack #devops channel
5. For critical production issues, page on-call engineer

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
