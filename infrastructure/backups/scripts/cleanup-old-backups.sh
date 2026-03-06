#!/bin/bash
# Cleanup Old Backups Script
# Removes backups older than retention period
# Runs daily at 3:00 AM IST via Kubernetes CronJob

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LOG_FILE="/var/log/postgresql/cleanup-backups.log"

# Retention policies
DAILY_RETENTION_DAYS=30
WEEKLY_RETENTION_WEEKS=52  # 1 year
WAL_RETENTION_DAYS=7

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting backup cleanup"
log "========================================="

# Calculate cutoff dates
DAILY_CUTOFF=$(date -d "${DAILY_RETENTION_DAYS} days ago" +%Y%m%d)
WEEKLY_CUTOFF=$(date -d "${WEEKLY_RETENTION_WEEKS} weeks ago" +%Y%m%d)
WAL_CUTOFF=$(date -d "${WAL_RETENTION_DAYS} days ago" +%Y%m%d)

log "Retention policies:"
log "  - Daily snapshots: ${DAILY_RETENTION_DAYS} days (cutoff: ${DAILY_CUTOFF})"
log "  - Weekly backups: ${WEEKLY_RETENTION_WEEKS} weeks (cutoff: ${WEEKLY_CUTOFF})"
log "  - WAL archives: ${WAL_RETENTION_DAYS} days (cutoff: ${WAL_CUTOFF})"

# Cleanup daily snapshots
log "Cleaning up daily snapshots..."
DAILY_DELETED=0

aws s3 ls "s3://${S3_BUCKET}/daily/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_daily_" | \
    while read -r file; do
        FILE_DATE=$(echo "$file" | sed 's/krishiai_daily_\([0-9]\{8\}\).*/\1/')
        if [ "$FILE_DATE" -lt "$DAILY_CUTOFF" ]; then
            log "Deleting daily snapshot: $file (date: ${FILE_DATE})"
            aws s3 rm "s3://${S3_BUCKET}/daily/${file}" --region "$AWS_REGION"
            DAILY_DELETED=$((DAILY_DELETED + 1))
        fi
    done

log "Deleted ${DAILY_DELETED} daily snapshots"

# Cleanup weekly backups
log "Cleaning up weekly backups..."
WEEKLY_DELETED=0

aws s3 ls "s3://${S3_BUCKET}/weekly/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_weekly_" | \
    while read -r file; do
        FILE_DATE=$(echo "$file" | sed 's/krishiai_weekly_\([0-9]\{8\}\).*/\1/')
        if [ "$FILE_DATE" -lt "$WEEKLY_CUTOFF" ]; then
            log "Deleting weekly backup: $file (date: ${FILE_DATE})"
            aws s3 rm "s3://${S3_BUCKET}/weekly/${file}" --region "$AWS_REGION"
            WEEKLY_DELETED=$((WEEKLY_DELETED + 1))
        fi
    done

log "Deleted ${WEEKLY_DELETED} weekly backups"

# Cleanup WAL archives
log "Cleaning up WAL archives..."
WAL_DELETED=0

# WAL files have format: 000000010000000000000001
# We need to check the modification time instead of filename
aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "wal-archive/" \
    --region "$AWS_REGION" \
    --query "Contents[?LastModified<='$(date -d "${WAL_RETENTION_DAYS} days ago" --iso-8601=seconds)'].Key" \
    --output text | \
    while read -r key; do
        if [ -n "$key" ] && [ "$key" != "None" ]; then
            log "Deleting WAL archive: $key"
            aws s3 rm "s3://${S3_BUCKET}/${key}" --region "$AWS_REGION"
            WAL_DELETED=$((WAL_DELETED + 1))
        fi
    done

log "Deleted ${WAL_DELETED} WAL archives"

# Calculate storage savings
log "Calculating storage statistics..."

DAILY_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --recursive --summarize --region "$AWS_REGION" | \
    grep "Total Size" | awk '{print $3}')
WEEKLY_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/weekly/" --recursive --summarize --region "$AWS_REGION" | \
    grep "Total Size" | awk '{print $3}')
WAL_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/wal-archive/" --recursive --summarize --region "$AWS_REGION" | \
    grep "Total Size" | awk '{print $3}')

TOTAL_SIZE=$((DAILY_SIZE + WEEKLY_SIZE + WAL_SIZE))
TOTAL_SIZE_GB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024 / 1024" | bc)

log "Current storage usage:"
log "  - Daily snapshots: $(echo "scale=2; $DAILY_SIZE / 1024 / 1024 / 1024" | bc) GB"
log "  - Weekly backups: $(echo "scale=2; $WEEKLY_SIZE / 1024 / 1024 / 1024" | bc) GB"
log "  - WAL archives: $(echo "scale=2; $WAL_SIZE / 1024 / 1024 / 1024" | bc) GB"
log "  - Total: ${TOTAL_SIZE_GB} GB"

# Export metrics for Prometheus
METRICS_FILE="/var/lib/postgresql/metrics/cleanup_metrics.prom"
mkdir -p "$(dirname "$METRICS_FILE")"

cat > "$METRICS_FILE" <<EOF
# HELP krishiai_backup_cleanup_last_run_timestamp Timestamp of last cleanup run
# TYPE krishiai_backup_cleanup_last_run_timestamp gauge
krishiai_backup_cleanup_last_run_timestamp $(date +%s)

# HELP krishiai_backup_files_deleted_total Total number of backup files deleted
# TYPE krishiai_backup_files_deleted_total counter
krishiai_backup_files_deleted_total{type="daily"} ${DAILY_DELETED}
krishiai_backup_files_deleted_total{type="weekly"} ${WEEKLY_DELETED}
krishiai_backup_files_deleted_total{type="wal"} ${WAL_DELETED}

# HELP krishiai_backup_storage_bytes Current backup storage usage in bytes
# TYPE krishiai_backup_storage_bytes gauge
krishiai_backup_storage_bytes{type="daily"} ${DAILY_SIZE}
krishiai_backup_storage_bytes{type="weekly"} ${WEEKLY_SIZE}
krishiai_backup_storage_bytes{type="wal"} ${WAL_SIZE}
krishiai_backup_storage_bytes{type="total"} ${TOTAL_SIZE}
EOF

log "Metrics exported to ${METRICS_FILE}"

# Summary
TOTAL_DELETED=$((DAILY_DELETED + WEEKLY_DELETED + WAL_DELETED))
log "========================================="
log "Backup cleanup completed"
log "Total files deleted: ${TOTAL_DELETED}"
log "  - Daily: ${DAILY_DELETED}"
log "  - Weekly: ${WEEKLY_DELETED}"
log "  - WAL: ${WAL_DELETED}"
log "Current storage: ${TOTAL_SIZE_GB} GB"
log "========================================="

exit 0
