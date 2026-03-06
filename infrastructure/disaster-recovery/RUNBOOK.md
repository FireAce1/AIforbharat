# Disaster Recovery Runbook

## KrishiAI Platform - PostgreSQL Disaster Recovery

**Version:** 1.0  
**Last Updated:** January 2026  
**Owner:** Database Team  
**On-Call:** +1-XXX-XXX-XXXX

---

## Table of Contents

1. [Overview](#overview)
2. [Emergency Contacts](#emergency-contacts)
3. [Failover Procedures](#failover-procedures)
4. [Failback Procedures](#failback-procedures)
5. [Health Monitoring](#health-monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Post-Incident Review](#post-incident-review)

---

## Overview

### Architecture

- **Primary Region:** us-east-1 (N. Virginia)
- **Secondary Region:** us-west-2 (Oregon)
- **Replication:** Asynchronous streaming replication
- **RTO:** 1 hour
- **RPO:** 5 minutes

### When to Failover

**Automatic Failover Triggers:**
- Primary database unreachable for 90 seconds (3 consecutive health check failures)
- Primary database query execution fails
- Replication lag exceeds 5 minutes

**Manual Failover Scenarios:**
- Planned maintenance in primary region
- Primary region experiencing widespread outage
- Data center disaster
- Network partition affecting primary region

---

## Emergency Contacts

### Primary Contacts

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Database Lead | [Name] | [Phone] | [Email] | @db-lead |
| DevOps Lead | [Name] | [Phone] | [Email] | @devops-lead |
| CTO | [Name] | [Phone] | [Email] | @cto |

### Escalation Path

1. **Level 1:** On-call Engineer (respond within 15 minutes)
2. **Level 2:** Database Lead (respond within 30 minutes)
3. **Level 3:** DevOps Lead (respond within 1 hour)
4. **Level 4:** CTO (for major incidents)

### Communication Channels

- **Incident Channel:** #incident-response
- **Status Updates:** #status-updates
- **War Room:** Zoom link in #incident-response pinned message

---

## Failover Procedures

### Pre-Failover Checklist

Before initiating failover, verify:

- [ ] Primary database is truly unavailable (not a false alarm)
- [ ] Replica database is healthy and reachable
- [ ] Replication lag is acceptable (<5 minutes preferred)
- [ ] Stakeholders are notified
- [ ] Incident channel is active

### Automated Failover

The failover controller automatically handles failover when health checks fail.

**Monitor Automated Failover:**

```bash
# Check failover controller logs
kubectl logs -l app=failover-controller --tail=100 -f

# Verify failover status
kubectl get pods -l app=failover-controller
```

**If automated failover fails, proceed to manual failover.**

### Manual Failover

**Step 1: Assess Situation (5 minutes)**

```bash
# Check primary health
./scripts/health-check.sh

# Check replication status
psql -h postgres-primary -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check replication lag
psql -h postgres-replica -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS lag;"
```

**Step 2: Notify Stakeholders (2 minutes)**

Post in #incident-response:
```
🚨 INCIDENT: Primary database failure detected
Status: Initiating failover to secondary region
ETA: 30 minutes
Impact: Brief service interruption during DNS propagation
```

**Step 3: Execute Failover (10-15 minutes)**

```bash
cd infrastructure/disaster-recovery/scripts
chmod +x promote-replica.sh
./promote-replica.sh
```

**Expected Output:**
- Replica health verified
- Replica promoted to primary
- DNS records updated
- Application configuration updated
- Notifications sent

**Step 4: Verify Failover (5 minutes)**

```bash
# Verify new primary is accepting connections
psql -h postgres-replica -U postgres -c "SELECT pg_is_in_recovery();"
# Should return: f (false)

# Test write operations
psql -h postgres-replica -U postgres -c "CREATE TABLE failover_test (id INT);"
psql -h postgres-replica -U postgres -c "DROP TABLE failover_test;"

# Check application connectivity
kubectl logs -l app=auth-service --tail=50
```

**Step 5: Monitor Application (15 minutes)**

```bash
# Check application pods
kubectl get pods

# Monitor error rates
# Check Grafana dashboard: "API Performance"

# Verify user-facing services
curl https://api.krishiai.in/health
```

**Step 6: Update Status (2 minutes)**

Post in #incident-response:
```
✅ RESOLVED: Failover completed successfully
New Primary: us-west-2
RTO: [actual time]
Impact: [describe any issues]
Next Steps: Monitor for 1 hour, investigate primary failure
```

### Failover Timeline

| Time | Action | Owner |
|------|--------|-------|
| T+0 | Incident detected | Monitoring |
| T+5 | Incident confirmed, stakeholders notified | On-call |
| T+10 | Failover initiated | On-call |
| T+25 | Failover completed | On-call |
| T+30 | Application verified | On-call |
| T+60 | Monitoring period complete | On-call |

---

## Failback Procedures

### When to Failback

Failback to primary region when:
- Primary region is fully restored and stable
- Root cause of failure is identified and resolved
- Sufficient time for testing (not during peak hours)
- Stakeholders are notified and approve

### Pre-Failback Checklist

- [ ] Primary region infrastructure restored
- [ ] Primary database tested and verified healthy
- [ ] Replication from secondary to primary established
- [ ] Replication lag is minimal (<1 minute)
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified
- [ ] Rollback plan prepared

### Failback Steps

**Step 1: Schedule Maintenance Window**

- Preferred time: 2:00 AM - 4:00 AM IST (low traffic)
- Duration: 2 hours
- Notify users 24 hours in advance

**Step 2: Prepare Primary Region (30 minutes)**

```bash
# Verify primary infrastructure
kubectl get nodes --context=us-east-1

# Verify primary database pod
kubectl get pods -l app=postgres-primary --context=us-east-1

# Test primary connectivity
psql -h postgres-primary -U postgres -c "SELECT version();"
```

**Step 3: Execute Failback (45 minutes)**

```bash
cd infrastructure/disaster-recovery/scripts
chmod +x failback-to-primary.sh
./failback-to-primary.sh
```

**Step 4: Verify Failback (15 minutes)**

```bash
# Verify primary is active
psql -h postgres-primary -U postgres -c "SELECT pg_is_in_recovery();"
# Should return: f (false)

# Verify replication to secondary
psql -h postgres-primary -U postgres -c "SELECT * FROM pg_stat_replication;"

# Test application connectivity
kubectl logs -l app=auth-service --tail=50
```

**Step 5: Monitor (30 minutes)**

- Monitor application metrics
- Check error rates
- Verify user-facing services
- Monitor replication lag

---

## Health Monitoring

### Manual Health Check

```bash
cd infrastructure/disaster-recovery/scripts
./health-check.sh
```

### Automated Monitoring

**Prometheus Metrics:**
- `krishiai_dr_primary_health_status`
- `krishiai_dr_replica_health_status`
- `krishiai_dr_replication_lag_seconds`
- `krishiai_dr_last_failover_timestamp`

**Grafana Dashboards:**
- Disaster Recovery Overview
- Replication Status
- Failover History

**Alerts:**
- Primary database down (PagerDuty)
- Replication lag >5 minutes (Slack)
- Replica database unhealthy (Slack)
- Failover triggered (PagerDuty + Slack)

### Health Check Schedule

- **Continuous:** Automated health checks every 30 seconds
- **Daily:** Manual health check review
- **Weekly:** Replication status review
- **Monthly:** DR drill and testing
- **Quarterly:** Full DR exercise

---

## Troubleshooting

### Issue: Replication Lag High

**Symptoms:**
- Replication lag >5 minutes
- Alert: "Replication lag exceeds threshold"

**Diagnosis:**
```bash
# Check replication status
psql -h postgres-primary -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check replica lag
psql -h postgres-replica -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp();"

# Check network latency
ping postgres-replica
```

**Resolution:**
1. Check network connectivity between regions
2. Verify replica has sufficient resources (CPU, memory, disk I/O)
3. Check for long-running queries on replica
4. Consider increasing `max_wal_senders` on primary
5. If persistent, consider synchronous replication

### Issue: Failover Controller Not Responding

**Symptoms:**
- Health checks failing but no automatic failover
- Failover controller pod not running

**Diagnosis:**
```bash
# Check failover controller status
kubectl get pods -l app=failover-controller

# Check logs
kubectl logs -l app=failover-controller --tail=200
```

**Resolution:**
1. Restart failover controller: `kubectl rollout restart deployment/failover-controller`
2. If still failing, execute manual failover
3. Investigate controller logs for errors
4. Check RBAC permissions

### Issue: DNS Not Updating After Failover

**Symptoms:**
- Failover completed but applications still connecting to old primary
- DNS queries returning old IP

**Diagnosis:**
```bash
# Check DNS records
nslookup postgres-primary.krishiai.in

# Check Route53 records (if using AWS)
aws route53 list-resource-record-sets --hosted-zone-id ZXXXXX
```

**Resolution:**
1. Manually update DNS records
2. Update application ConfigMaps: `kubectl edit configmap postgres-config`
3. Restart application pods: `kubectl rollout restart deployment/auth-service`
4. Clear DNS cache on application servers

### Issue: Split-Brain Scenario

**Symptoms:**
- Both primary and replica accepting writes
- Data inconsistency between regions

**Diagnosis:**
```bash
# Check if both are primaries
psql -h postgres-primary -U postgres -c "SELECT pg_is_in_recovery();"
psql -h postgres-replica -U postgres -c "SELECT pg_is_in_recovery();"
# Both should NOT return 'f'
```

**Resolution:**
1. **STOP IMMEDIATELY** - Do not allow writes to both
2. Identify which database has most recent data
3. Shut down the database with older data
4. Reconfigure as replica
5. Verify replication before resuming service
6. **ESCALATE** to Database Lead immediately

---

## Post-Incident Review

### Incident Report Template

**Incident ID:** DR-YYYY-MM-DD-XXX  
**Date:** YYYY-MM-DD  
**Duration:** X hours  
**Severity:** Critical/High/Medium/Low

**Summary:**
[Brief description of incident]

**Timeline:**
- T+0: [Event]
- T+5: [Event]
- ...

**Root Cause:**
[Detailed analysis]

**Impact:**
- Users affected: X
- Services impacted: [List]
- Data loss: Yes/No
- Revenue impact: $X

**Resolution:**
[How was it resolved]

**Action Items:**
1. [Action] - Owner: [Name] - Due: [Date]
2. [Action] - Owner: [Name] - Due: [Date]

**Lessons Learned:**
- What went well
- What could be improved
- Process changes needed

### Post-Incident Checklist

- [ ] Incident report completed
- [ ] Root cause identified
- [ ] Action items assigned
- [ ] Stakeholders notified
- [ ] Documentation updated
- [ ] Monitoring improved
- [ ] Runbook updated
- [ ] Team debrief scheduled

---

## Appendix

### Useful Commands

```bash
# Check replication status
psql -h postgres-primary -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check replication lag
psql -h postgres-replica -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp();"

# Promote replica manually
psql -h postgres-replica -U postgres -c "SELECT pg_promote();"

# Check if database is in recovery
psql -h postgres-replica -U postgres -c "SELECT pg_is_in_recovery();"

# View WAL sender status
psql -h postgres-primary -U postgres -c "SELECT * FROM pg_stat_wal_receiver;"
```

### Reference Links

- [PostgreSQL Replication Documentation](https://www.postgresql.org/docs/14/warm-standby.html)
- [Disaster Recovery Best Practices](https://www.postgresql.org/docs/14/high-availability.html)
- [KrishiAI Infrastructure Documentation](../README.md)
- [Backup System Documentation](../backups/README.md)

---

**Document Version:** 1.0  
**Last Reviewed:** January 2026  
**Next Review:** April 2026 (Quarterly)
