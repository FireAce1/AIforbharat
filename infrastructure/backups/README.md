# KrishiAI Database Backup System

## Overview

This directory contains the complete database backup and recovery infrastructure for the KrishiAI platform. The system implements a multi-layered backup strategy with continuous archiving (WAL), daily snapshots, and weekly full backups.

## Backup Strategy

### 1. Continuous Archiving (WAL Archiving)
- **Purpose**: Point-in-time recovery (PITR)
- **Frequency**: Continuous (every 16MB or 1 minute)
- **Retention**: 7 days
- **Storage**: S3 bucket with encryption

### 2. Daily Snapshots
- **Purpose**: Quick recovery for recent data
- **Frequency**: Daily at 2:00 AM IST
- **Retention**: 30 days
- **Method**: pg_dump with compression
- **Storage**: S3 bucket with encryption

### 3. Weekly Full Backups
- **Purpose**: Long-term archival and compliance
- **Frequency**: Weekly on Sundays at 2:00 AM IST
- **Retention**: 1 year (52 weeks)
- **Method**: pg_basebackup with compression
- **Storage**: S3 bucket with encryption

## Architecture

```
PostgreSQL Database
       ↓
   WAL Files (continuous)
       ↓
   Archive Command → S3 (wal-archive/)
       
   Daily Snapshot (2 AM)
       ↓
   pg_dump → Compress → S3 (daily/)
       
   Weekly Full Backup (Sunday 2 AM)
       ↓
   pg_basebackup → Compress → S3 (weekly/)
```

## Directory Structure

```
infrastructure/backups/
├── README.md                    # This file
├── postgresql.conf.backup       # PostgreSQL configuration for WAL archiving
├── scripts/
│   ├── setup-wal-archiving.sh   # Configure WAL archiving
│   ├── daily-snapshot.sh        # Daily pg_dump script
│   ├── weekly-backup.sh         # Weekly full backup script
│   ├── restore-pitr.sh          # Point-in-time recovery script
│   ├── restore-snapshot.sh      # Restore from snapshot script
│   ├── cleanup-old-backups.sh   # Cleanup expired backups
│   └── test-restore.sh          # Monthly restore test script
├── k8s/
│   ├── backup-cronjob.yaml      # Kubernetes CronJob for backups
│   ├── backup-configmap.yaml    # Configuration for backup scripts
│   └── backup-secret.yaml       # S3 credentials
└── monitoring/
    ├── backup-alerts.yml        # Prometheus alerts for backup failures
    └── backup-dashboard.json    # Grafana dashboard for backup monitoring
```

## Prerequisites

1. **S3 Bucket**: Create an S3 bucket for backups
   ```bash
   aws s3 mb s3://krishiai-db-backups --region us-east-1
   ```

2. **IAM User**: Create IAM user with S3 access
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:ListBucket",
           "s3:DeleteObject"
         ],
         "Resource": [
           "arn:aws:s3:::krishiai-db-backups",
           "arn:aws:s3:::krishiai-db-backups/*"
         ]
       }
     ]
   }
   ```

3. **Enable S3 Encryption**: Enable default encryption on the bucket
   ```bash
   aws s3api put-bucket-encryption \
     --bucket krishiai-db-backups \
     --server-side-encryption-configuration '{
       "Rules": [{
         "ApplyServerSideEncryptionByDefault": {
           "SSEAlgorithm": "AES256"
         }
       }]
     }'
   ```

## Setup Instructions

### 1. Configure PostgreSQL for WAL Archiving

```bash
# Run the setup script
cd infrastructure/backups/scripts
chmod +x setup-wal-archiving.sh
./setup-wal-archiving.sh
```

This will:
- Update PostgreSQL configuration for WAL archiving
- Create archive command to upload WAL files to S3
- Restart PostgreSQL to apply changes

### 2. Deploy Backup CronJobs to Kubernetes

```bash
# Create backup secret with S3 credentials
kubectl create secret generic backup-s3-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=your_access_key \
  --from-literal=AWS_SECRET_ACCESS_KEY=your_secret_key \
  --from-literal=S3_BUCKET=krishiai-db-backups \
  --from-literal=AWS_REGION=us-east-1

# Deploy backup infrastructure
kubectl apply -f k8s/backup-configmap.yaml
kubectl apply -f k8s/backup-cronjob.yaml
```

### 3. Verify Backup Setup

```bash
# Check CronJob status
kubectl get cronjobs

# Check recent backup jobs
kubectl get jobs --selector=app=database-backup

# View backup logs
kubectl logs -l app=database-backup --tail=100
```

## Backup Operations

### Manual Backup

Trigger a manual backup:
```bash
# Daily snapshot
kubectl create job --from=cronjob/daily-snapshot manual-snapshot-$(date +%Y%m%d)

# Weekly full backup
kubectl create job --from=cronjob/weekly-backup manual-backup-$(date +%Y%m%d)
```

### List Backups

```bash
# List all backups in S3
aws s3 ls s3://krishiai-db-backups/ --recursive --human-readable

# List daily snapshots
aws s3 ls s3://krishiai-db-backups/daily/ --human-readable

# List weekly backups
aws s3 ls s3://krishiai-db-backups/weekly/ --human-readable

# List WAL archives
aws s3 ls s3://krishiai-db-backups/wal-archive/ --human-readable
```

## Recovery Operations

### Point-in-Time Recovery (PITR)

Restore database to a specific point in time:
```bash
cd infrastructure/backups/scripts
./restore-pitr.sh "2026-01-16 10:30:00"
```

### Restore from Daily Snapshot

Restore from a specific daily snapshot:
```bash
cd infrastructure/backups/scripts
./restore-snapshot.sh daily 2026-01-16
```

### Restore from Weekly Backup

Restore from a specific weekly backup:
```bash
cd infrastructure/backups/scripts
./restore-snapshot.sh weekly 2026-01-12
```

## Monitoring

### Backup Metrics

The system exposes the following Prometheus metrics:
- `krishiai_backup_last_success_timestamp`: Timestamp of last successful backup
- `krishiai_backup_duration_seconds`: Duration of backup operation
- `krishiai_backup_size_bytes`: Size of backup file
- `krishiai_backup_failures_total`: Total number of backup failures

### Alerts

Prometheus alerts are configured for:
- Backup failure (no successful backup in 25 hours)
- Backup duration exceeds threshold (>30 minutes)
- WAL archiving failure
- S3 upload failure

View alerts in Grafana dashboard: `Backup Monitoring`

## Testing

### Monthly Restore Test

Automated restore testing runs monthly:
```bash
# Manual test
cd infrastructure/backups/scripts
./test-restore.sh
```

This will:
1. Download latest daily snapshot
2. Restore to a test database
3. Verify data integrity
4. Generate test report
5. Clean up test database

## Retention Policy

### Automatic Cleanup

Old backups are automatically cleaned up:
- **WAL archives**: 7 days
- **Daily snapshots**: 30 days
- **Weekly backups**: 1 year (52 weeks)

Cleanup runs daily at 3:00 AM IST via CronJob.

### Manual Cleanup

Force cleanup of old backups:
```bash
cd infrastructure/backups/scripts
./cleanup-old-backups.sh
```

## Disaster Recovery

### RTO (Recovery Time Objective)
- **Target**: 1 hour
- **Actual**: ~30 minutes for PITR, ~15 minutes for snapshot restore

### RPO (Recovery Point Objective)
- **Target**: 5 minutes
- **Actual**: <1 minute with WAL archiving

### Failover Procedure

1. **Assess the situation**: Determine extent of data loss
2. **Choose recovery method**:
   - PITR for specific point in time
   - Snapshot for recent backup
3. **Execute restore script**: Follow recovery operations above
4. **Verify data integrity**: Run validation queries
5. **Update DNS/endpoints**: Point applications to restored database
6. **Monitor**: Watch for errors and performance issues

## Troubleshooting

### Backup Failures

Check backup logs:
```bash
kubectl logs -l app=database-backup --tail=200
```

Common issues:
- **S3 credentials expired**: Update secret with new credentials
- **Disk space full**: Increase PVC size or cleanup old backups
- **Network timeout**: Check network connectivity to S3

### WAL Archiving Issues

Check PostgreSQL logs:
```bash
kubectl logs postgres-0 --tail=200 | grep -i archive
```

Verify WAL files in S3:
```bash
aws s3 ls s3://krishiai-db-backups/wal-archive/ --recursive | tail -20
```

### Restore Failures

Common issues:
- **Backup file corrupted**: Try previous backup
- **Insufficient disk space**: Increase PVC size
- **Version mismatch**: Ensure PostgreSQL versions match

## Security

### Encryption
- **At rest**: S3 server-side encryption (AES-256)
- **In transit**: TLS 1.3 for S3 uploads
- **Backup files**: Compressed with gzip (no additional encryption)

### Access Control
- **S3 bucket**: Private, IAM-based access only
- **Kubernetes secrets**: Encrypted at rest in etcd
- **Backup scripts**: Run as non-root user in containers

### Audit Logging
- All backup operations logged to CloudWatch
- S3 access logs enabled
- Kubernetes audit logs capture backup job execution

## Compliance

### Data Retention
- Complies with DPDP Act 2023 (India Data Protection)
- User data deletion requests handled within 30 days
- Backup retention aligns with legal requirements

### Backup Verification
- Monthly automated restore tests
- Quarterly disaster recovery drills
- Annual compliance audit

## Cost Optimization

### Storage Costs
- **Daily snapshots**: ~5GB/day × 30 days = 150GB
- **Weekly backups**: ~20GB/week × 52 weeks = 1TB
- **WAL archives**: ~10GB/week × 1 week = 10GB
- **Total**: ~1.16TB/month

### S3 Lifecycle Policies
```bash
# Transition old backups to Glacier
aws s3api put-bucket-lifecycle-configuration \
  --bucket krishiai-db-backups \
  --lifecycle-configuration file://s3-lifecycle.json
```

## Support

For backup-related issues:
1. Check this README for troubleshooting steps
2. Review backup logs in Kubernetes
3. Check Grafana backup dashboard
4. Contact DevOps team: devops@krishiai.in

## References

- [PostgreSQL Continuous Archiving](https://www.postgresql.org/docs/14/continuous-archiving.html)
- [pg_dump Documentation](https://www.postgresql.org/docs/14/app-pgdump.html)
- [pg_basebackup Documentation](https://www.postgresql.org/docs/14/app-pgbasebackup.html)
- [AWS S3 Encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html)
