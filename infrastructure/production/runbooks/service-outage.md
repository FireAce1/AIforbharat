# Runbook: Complete Service Outage

## Symptoms
- All API endpoints returning 503 or timing out
- Mobile app cannot connect to backend
- Health check endpoints failing
- Users reporting "Service Unavailable" errors

## Severity
**P0 - Critical** (Response time: 15 minutes)

## Initial Response Checklist

### 1. Verify the Outage (2 minutes)
```bash
# Check if services are responding
curl -I https://api.krishiai.in/health

# Check from multiple locations
curl -I https://api.krishiai.in/health --resolve api.krishiai.in:443:$(dig +short api.krishiai.in)

# Check status page
open https://status.krishiai.in
```

### 2. Check Kubernetes Cluster (3 minutes)
```bash
# Configure kubectl
aws eks update-kubeconfig --name krishiai-production --region ap-south-1

# Check cluster nodes
kubectl get nodes
# Expected: All nodes should be Ready

# Check all pods
kubectl get pods -n krishiai-prod
# Expected: All pods should be Running

# Check pod events
kubectl get events -n krishiai-prod --sort-by='.lastTimestamp'
```

### 3. Check Infrastructure (3 minutes)
```bash
# Check AWS service health
aws health describe-events --filter eventTypeCategories=issue

# Check EKS cluster status
aws eks describe-cluster --name krishiai-production --region ap-south-1

# Check RDS status
aws rds describe-db-instances --db-instance-identifier krishiai-production-db

# Check ElastiCache status
aws elasticache describe-replication-groups --replication-group-id krishiai-prod-redis
```

## Common Causes and Solutions

### Cause 1: Kubernetes Cluster Issues

#### Symptoms
- Nodes showing NotReady status
- Pods stuck in Pending or CrashLoopBackOff

#### Investigation
```bash
# Check node status
kubectl describe nodes

# Check pod logs
kubectl logs -n krishiai-prod deployment/auth-service --tail=100

# Check resource usage
kubectl top nodes
kubectl top pods -n krishiai-prod
```

#### Resolution
```bash
# If nodes are NotReady, try draining and restarting
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node-name>

# If pods are failing, check for resource constraints
kubectl describe pod <pod-name> -n krishiai-prod

# Scale up if needed
kubectl scale deployment/<service-name> --replicas=5 -n krishiai-prod
```

### Cause 2: Ingress Controller Failure

#### Symptoms
- Pods are running but external access fails
- Load balancer health checks failing

#### Investigation
```bash
# Check ingress status
kubectl get ingress -n krishiai-prod
kubectl describe ingress krishiai-ingress -n krishiai-prod

# Check ingress controller pods
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

#### Resolution
```bash
# Restart ingress controller
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx

# Verify ingress configuration
kubectl get ingress krishiai-ingress -n krishiai-prod -o yaml

# Check load balancer
aws elbv2 describe-load-balancers
aws elbv2 describe-target-health --target-group-arn <arn>
```

### Cause 3: Database Connection Failure

#### Symptoms
- Services report database connection errors
- Pods are running but returning 500 errors

#### Investigation
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier krishiai-production-db

# Test database connectivity from pod
kubectl exec -it deployment/auth-service -n krishiai-prod -- sh
# Inside pod:
nc -zv $DB_HOST 5432
psql -h $DB_HOST -U $DB_USER -d krishiai -c "SELECT 1"
```

#### Resolution
```bash
# Check security groups
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# Verify database credentials
kubectl get secret krishiai-secrets -n krishiai-prod -o yaml

# If connection pool exhausted, restart services
kubectl rollout restart deployment/auth-service -n krishiai-prod
kubectl rollout restart deployment/crop-service -n krishiai-prod
```

### Cause 4: Recent Deployment Issue

#### Symptoms
- Outage started immediately after deployment
- New pods failing to start

#### Investigation
```bash
# Check recent deployments
kubectl rollout history deployment/auth-service -n krishiai-prod

# Check pod logs for errors
kubectl logs -n krishiai-prod deployment/auth-service --tail=100

# Check deployment events
kubectl describe deployment auth-service -n krishiai-prod
```

#### Resolution
```bash
# Rollback to previous version
kubectl rollout undo deployment/auth-service -n krishiai-prod

# Verify rollback
kubectl rollout status deployment/auth-service -n krishiai-prod

# Rollback all services if needed
for service in auth-service crop-service market-service climate-service govt-service; do
  kubectl rollout undo deployment/$service -n krishiai-prod
done
```

### Cause 5: Resource Exhaustion

#### Symptoms
- Pods being evicted
- OOMKilled errors in pod status
- High CPU/memory usage

#### Investigation
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n krishiai-prod

# Check for evicted pods
kubectl get pods -n krishiai-prod | grep Evicted

# Check pod resource limits
kubectl describe pod <pod-name> -n krishiai-prod | grep -A 5 "Limits"
```

#### Resolution
```bash
# Scale up node group
aws eks update-nodegroup-config \
  --cluster-name krishiai-production \
  --nodegroup-name general \
  --scaling-config desiredSize=5,minSize=3,maxSize=10

# Increase pod replicas temporarily
kubectl scale deployment/auth-service --replicas=5 -n krishiai-prod

# Clean up evicted pods
kubectl delete pods --field-selector status.phase=Failed -n krishiai-prod
```

## Communication Template

### Initial Notification (Within 5 minutes)
```
🚨 CRITICAL INCIDENT - P0

Service: All KrishiAI Services
Impact: Complete service outage - all users affected
Status: Investigating
ETA: Under investigation

We are actively working to restore service. Updates every 15 minutes.

Incident ID: INC-[TIMESTAMP]
Started: [TIME]

- KrishiAI Incident Response Team
```

### Update Notification (Every 15 minutes)
```
🔄 INCIDENT UPDATE - INC-[ID]

Status: [Investigating/Mitigating/Resolving]
Progress: [What we've found/done]
ETA: [Updated estimate]
Next Update: [TIME]

- KrishiAI Incident Response Team
```

### Resolution Notification
```
✅ INCIDENT RESOLVED - INC-[ID]

Service: All KrishiAI Services
Duration: [START] - [END] ([DURATION])
Root Cause: [Brief description]
Resolution: [What was done]

All services are now operating normally. We apologize for the inconvenience.

Post-incident report will be available within 48 hours.

- KrishiAI Incident Response Team
```

## Escalation

### 0-15 minutes
- Primary on-call investigates
- Create incident war room
- Notify secondary on-call

### 15-30 minutes
- Engage secondary on-call
- Notify manager on-call
- Update status page

### 30-60 minutes
- Escalate to manager on-call
- Consider engaging AWS support
- Prepare for extended outage communication

### 60+ minutes
- Engage external support (AWS Premium Support)
- Consider failover to disaster recovery region
- Executive notification

## Post-Incident Actions

### Immediate (Within 1 hour of resolution)
- [ ] Verify all services are healthy
- [ ] Monitor for recurrence
- [ ] Send resolution notification
- [ ] Update status page

### Short-term (Within 24 hours)
- [ ] Document incident timeline
- [ ] Collect all relevant logs
- [ ] Schedule post-mortem meeting
- [ ] Notify affected users

### Long-term (Within 48 hours)
- [ ] Complete post-mortem document
- [ ] Identify action items
- [ ] Update runbooks
- [ ] Implement preventive measures

## Prevention Checklist

- [ ] Implement better health checks
- [ ] Add more monitoring alerts
- [ ] Improve deployment process
- [ ] Add chaos engineering tests
- [ ] Review capacity planning
- [ ] Update disaster recovery procedures

## Related Runbooks
- [Database Issues](./database-issues.md)
- [Performance Issues](./performance-issues.md)
- [Deployment Rollback](./deployment-rollback.md)

## Contact Information
- Primary On-Call: +91-XXXX-XXXXXX
- AWS Support: Case via console
- Slack: #incidents
