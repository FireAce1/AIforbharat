# KrishiAI Disaster Recovery System

## Overview

This directory contains the disaster recovery (DR) infrastructure for the KrishiAI platform, implementing cross-region replication, automated failover, and comprehensive recovery procedures.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Primary Region (us-east-1)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Primary (Master)                      │  │
│  │  - Read/Write operations                          │  │
│  │  - WAL streaming to replica                       │  │
│  │  - Health checks every 30s                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ WAL Streaming
                          ↓ (Async Replication)
┌─────────────────────────────────────────────────────────┐
│           Secondary Region (us-west-2)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Replica (Standby)                     │  │
│  │  - Read-only operations                           │  │
│  │  - Receives WAL from primary                      │  │
│  │  - Promotes to primary on failover                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↑
                          ↓ Health Monitoring
┌─────────────────────────────────────────────────────────┐
│              Failover Controller                         │
│  - Monitors primary health (30s interval)                │
│  - Detects failures (3 consecutive failures)             │
│  - Triggers automated failover                           │
│  - Updates DNS/Load Balancer                             │
│  - Notifies operations team                              │
└─────────────────────────────────────────────────────────┘
```

## Recovery Objectives

- **RTO (Recovery Time Objective):** 1 hour
- **RPO (Recovery Point Objective):** 5 minutes
- **Availability Target:** 99.9% (8.76 hours downtime/year)

## Components

### 1. Cross-Region Replication

PostgreSQL streaming replication from primary (us-east-1) to replica (us-west-2):
- **Replication Mode:** Asynchronous (for performance)
- **Replication Lag:** Target <30 seconds
- **WAL Shipping:** Continuous streaming
- **Monitoring:** Replication lag, connection status

### 2. Automated Failover

Health check-based failover system:
- **Health Check Interval:** 30 seconds
- **Failure Threshold:** 3 consecutive failures (90 seconds)
- **Failover Actions:**
  1. Promote replica to primary
  2. Update DNS records
  3. Reconfigure application endpoints
  4. Send notifications
- **Rollback:** Manual process with validation

### 3. Health Monitoring

Comprehensive health checks:
- **Database Connectivity:** TCP connection test
- **Query Execution:** Simple SELECT query
- **Replication Status:** Lag monitoring
- **Disk Space:** Available storage check
- **CPU/Memory:** Resource utilization

### 4. Disaster Recovery Testing

Quarterly DR drills:
- **Failover Test:** Simulate primary failure
- **Failback Test:** Restore primary region
- **Data Integrity:** Verify data consistency
- **Application Testing:** End-to-end validation
- **Documentation:** Update runbooks

## Files

### Configuration
- `postgresql-primary.conf` - Primary database configuration
- `postgresql-replica.conf` - Replica database configuration
- `pg_hba.conf` - Replication authentication

### Scripts
- `scripts/setup-replication.sh` - Initial replication setup
- `scripts/promote-replica.sh` - Manual failover to replica
- `scripts/failback-to-primary.sh` - Restore primary region
- `scripts/health-check.sh` - Database health monitoring
- `scripts/test-failover.sh` - DR drill automation

### Kubernetes
- `k8s/postgres-primary-deployment.yaml` - Primary database
- `k8s/postgres-replica-deployment.yaml` - Replica database
- `k8s/failover-controller-deployment.yaml` - Failover automation
- `k8s/health-monitor-cronjob.yaml` - Health monitoring

### Documentation
- `RUNBOOK.md` - Operational procedures
- `FAILOVER_PROCEDURES.md` - Step-by-step failover guide
- `TESTING_GUIDE.md` - DR testing procedures

## Quick Start

### Prerequisites

1. Two Kubernetes clusters in different regions
2. Network connectivity between regions
3. S3 buckets for WAL archiving in both regions
4. DNS management access (Route53)

### Setup

1. **Deploy Primary Database:**
```bash
kubectl apply -f k8s/postgres-primary-deployment.yaml --context=us-east-1
```

2. **Setup Replication:**
```bash
cd scripts
./setup-replication.sh
```

3. **Deploy Replica Database:**
```bash
kubectl apply -f k8s/postgres-replica-deployment.yaml --context=us-west-2
```

4. **Deploy Failover Controller:**
```bash
kubectl apply -f k8s/failover-controller-deployment.yaml
```

5. **Verify Replication:**
```bash
./scripts/health-check.sh
```

## Failover Procedures

### Automated Failover

The failover controller automatically triggers failover when:
- Primary database is unreachable for 90 seconds
- Primary database query execution fails
- Replication lag exceeds 5 minutes

**Failover Process:**
1. Detect primary failure (3 consecutive health check failures)
2. Verify replica is healthy and up-to-date
3. Promote replica to primary
4. Update DNS to point to new primary
5. Reconfigure application connection strings
6. Send notifications to operations team
7. Log failover event

### Manual Failover

For planned maintenance or testing:

```bash
cd scripts
./promote-replica.sh
```

### Failback to Primary

After primary region is restored:

```bash
cd scripts
./failback-to-primary.sh
```

## Monitoring

### Prometheus Metrics

```
krishiai_dr_primary_health_status (1=healthy, 0=unhealthy)
krishiai_dr_replica_health_status (1=healthy, 0=unhealthy)
krishiai_dr_replication_lag_seconds
krishiai_dr_last_failover_timestamp
krishiai_dr_failover_count_total
krishiai_dr_health_check_duration_seconds
```

### Alerts

- Primary database down for >90 seconds
- Replication lag >5 minutes
- Replica database unhealthy
- Failover triggered
- Failback completed

## Testing

### Monthly Health Checks

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check replication status
./scripts/check-replication-status.sh
```

### Quarterly DR Drills

```bash
# Full DR drill (automated)
./scripts/test-failover.sh

# Manual validation
# 1. Verify application connectivity
# 2. Test read/write operations
# 3. Check data consistency
# 4. Validate monitoring alerts
```

## Security

- **Replication Authentication:** Certificate-based
- **Network Encryption:** TLS 1.3 for replication traffic
- **Access Control:** IP whitelisting between regions
- **Secrets Management:** Kubernetes secrets, AWS Secrets Manager

## Cost Optimization

- **Replica Instance:** Same size as primary (for failover readiness)
- **Cross-Region Data Transfer:** ~$0.02/GB
- **Estimated Monthly Cost:** $500-800 (depending on data volume)

## Troubleshooting

### Replication Lag

```bash
# Check replication lag
psql -h replica-host -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"

# Common causes:
# - Network latency
# - High write load on primary
# - Replica resource constraints
```

### Failover Issues

```bash
# Check failover controller logs
kubectl logs -l app=failover-controller --tail=200

# Common issues:
# - DNS propagation delay
# - Application connection pool not refreshed
# - Replica not fully caught up
```

## Compliance

- **Data Residency:** Both regions in US for compliance
- **Backup Retention:** Aligned with primary backup policy
- **Audit Logging:** All failover events logged
- **Testing Requirements:** Quarterly DR drills documented

## Support

For DR-related issues:
1. Check runbook: `RUNBOOK.md`
2. Review failover logs
3. Contact on-call engineer
4. Escalate to database team if needed

## References

- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/14/warm-standby.html)
- [High Availability Best Practices](https://www.postgresql.org/docs/14/high-availability.html)
- Task Requirements: `.kiro/specs/krishiai-mvp/requirements.md` (Requirement 13.3)

---

**Status:** Implementation Complete  
**Last Updated:** January 2026  
**Next Review:** Quarterly DR Drill
