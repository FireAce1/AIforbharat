#!/bin/bash
# Daily Database Snapshot Script
# Creates compressed pg_dump backup and uploads to S3
# Runs daily at 2:00 AM IST via Kubernetes CronJob

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration from environment variables
DB_HOST="${DB_HOST:-postgres-service}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-krishiai_db}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD}"
export PGPASSWORD

S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
S3_PREFIX="daily"
AWS_REGION="${AWS_REGION:-us-east-1}"
RETENTION_DAYS=30

# Backup metadata
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="krishiai_daily_${TIMESTAMP}.sql.gz"
TEMP_DIR="/tmp/backups"
LOG_FILE="/var/log/postgresql/daily-backup.log"

# Create temp directory
mkdir -p "$TEMP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    # Send alert (could integrate with Prometheus Alertmanager)
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files"
    rm -f "${TEMP_DIR}/${BACKUP_FILE}"
}
trap cleanup EXIT

log "========================================="
log "Starting daily database snapshot"
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "========================================="

# Check database connectivity
log "Checking database connectivity..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    error_exit "Database is not accessible"
fi
log "Database is accessible"

# Start backup
START_TIME=$(date +%s)
log "Creating database dump..."

# pg_dump with compression
# --format=custom for better compression and parallel restore
# --compress=9 for maximum compression
# --verbose for detailed logging
if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${TEMP_DIR}/${BACKUP_FILE}" 2>&1 | tee -a "$LOG_FILE"; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    BACKUP_SIZE=$(du -h "${TEMP_DIR}/${BACKUP_FILE}" | cut -f1)
    
    log "Database dump completed successfully"
    log "Duration: ${DURATION} seconds"
    log "Backup size: ${BACKUP_SIZE}"
else
    error_exit "Database dump failed"
fi

# Upload to S3
log "Uploading backup to S3..."
S3_DESTINATION="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

UPLOAD_START=$(date +%s)
if aws s3 cp "${TEMP_DIR}/${BACKUP_FILE}" "$S3_DESTINATION" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256 \
    --metadata "backup-type=daily,database=${DB_NAME},timestamp=${TIMESTAMP}" \
    --only-show-errors 2>&1 | tee -a "$LOG_FILE"; then
    
    UPLOAD_END=$(date +%s)
    UPLOAD_DURATION=$((UPLOAD_END - UPLOAD_START))
    
    log "Upload completed successfully"
    log "Upload duration: ${UPLOAD_DURATION} seconds"
    log "S3 location: ${S3_DESTINATION}"
else
    error_exit "Failed to upload backup to S3"
fi

# Verify upload
log "Verifying backup in S3..."
if aws s3 ls "$S3_DESTINATION" --region "$AWS_REGION" >/dev/null 2>&1; then
    S3_SIZE=$(aws s3 ls "$S3_DESTINATION" --region "$AWS_REGION" | awk '{print $3}')
    log "Backup verified in S3 (size: ${S3_SIZE} bytes)"
else
    error_exit "Backup verification failed"
fi

# Cleanup old backups (retention policy: 30 days)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d)

aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_daily_" | \
    while read -r file; do
        FILE_DATE=$(echo "$file" | sed 's/krishiai_daily_\([0-9]\{8\}\).*/\1/')
        if [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
            log "Deleting old backup: $file"
            aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}" --region "$AWS_REGION"
        fi
    done

log "Cleanup completed"

# Export metrics for Prometheus
METRICS_FILE="/var/lib/postgresql/metrics/backup_metrics.prom"
mkdir -p "$(dirname "$METRICS_FILE")"

cat > "$METRICS_FILE" <<EOF
# HELP krishiai_backup_last_success_timestamp Timestamp of last successful backup
# TYPE krishiai_backup_last_success_timestamp gauge
krishiai_backup_last_success_timestamp{type="daily"} $(date +%s)

# HELP krishiai_backup_duration_seconds Duration of backup operation
# TYPE krishiai_backup_duration_seconds gauge
krishiai_backup_duration_seconds{type="daily"} ${DURATION}

# HELP krishiai_backup_size_bytes Size of backup file
# TYPE krishiai_backup_size_bytes gauge
krishiai_backup_size_bytes{type="daily"} $(stat -f%z "${TEMP_DIR}/${BACKUP_FILE}" 2>/dev/null || stat -c%s "${TEMP_DIR}/${BACKUP_FILE}")

# HELP krishiai_backup_upload_duration_seconds Duration of S3 upload
# TYPE krishiai_backup_upload_duration_seconds gauge
krishiai_backup_upload_duration_seconds{type="daily"} ${UPLOAD_DURATION}
EOF

log "Metrics exported to ${METRICS_FILE}"

# Summary
TOTAL_TIME=$((END_TIME - START_TIME + UPLOAD_DURATION))
log "========================================="
log "Daily snapshot completed successfully"
log "Total time: ${TOTAL_TIME} seconds"
log "Backup file: ${BACKUP_FILE}"
log "S3 location: ${S3_DESTINATION}"
log "========================================="

exit 0
