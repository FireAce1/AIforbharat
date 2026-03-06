#!/bin/bash
# Weekly Full Database Backup Script
# Creates full base backup using pg_basebackup and uploads to S3
# Runs weekly on Sundays at 2:00 AM IST via Kubernetes CronJob

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
S3_PREFIX="weekly"
AWS_REGION="${AWS_REGION:-us-east-1}"
RETENTION_WEEKS=52  # 1 year

# Backup metadata
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WEEK_NUMBER=$(date +%Y_W%V)
BACKUP_DIR="krishiai_weekly_${TIMESTAMP}"
BACKUP_ARCHIVE="${BACKUP_DIR}.tar.gz"
TEMP_DIR="/tmp/backups"
LOG_FILE="/var/log/postgresql/weekly-backup.log"

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
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files"
    rm -rf "${TEMP_DIR}/${BACKUP_DIR}"
    rm -f "${TEMP_DIR}/${BACKUP_ARCHIVE}"
}
trap cleanup EXIT

log "========================================="
log "Starting weekly full database backup"
log "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log "Week: ${WEEK_NUMBER}"
log "========================================="

# Check database connectivity
log "Checking database connectivity..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    error_exit "Database is not accessible"
fi
log "Database is accessible"

# Start backup
START_TIME=$(date +%s)
log "Creating base backup with pg_basebackup..."

# pg_basebackup creates a full backup of the database cluster
# --format=tar for easy compression
# --gzip for compression
# --progress for progress reporting
# --checkpoint=fast to force immediate checkpoint
# --wal-method=fetch to include WAL files
if pg_basebackup \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -D "${TEMP_DIR}/${BACKUP_DIR}" \
    --format=tar \
    --gzip \
    --progress \
    --checkpoint=fast \
    --wal-method=fetch \
    --verbose 2>&1 | tee -a "$LOG_FILE"; then
    
    BASEBACKUP_END=$(date +%s)
    BASEBACKUP_DURATION=$((BASEBACKUP_END - START_TIME))
    
    log "Base backup completed successfully"
    log "Duration: ${BASEBACKUP_DURATION} seconds"
else
    error_exit "Base backup failed"
fi

# Create compressed archive
log "Creating compressed archive..."
COMPRESS_START=$(date +%s)

cd "$TEMP_DIR"
if tar -czf "${BACKUP_ARCHIVE}" "${BACKUP_DIR}"; then
    COMPRESS_END=$(date +%s)
    COMPRESS_DURATION=$((COMPRESS_END - COMPRESS_START))
    BACKUP_SIZE=$(du -h "${BACKUP_ARCHIVE}" | cut -f1)
    
    log "Archive created successfully"
    log "Compression duration: ${COMPRESS_DURATION} seconds"
    log "Archive size: ${BACKUP_SIZE}"
else
    error_exit "Failed to create archive"
fi

# Upload to S3
log "Uploading backup to S3..."
S3_DESTINATION="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_ARCHIVE}"

UPLOAD_START=$(date +%s)
if aws s3 cp "${TEMP_DIR}/${BACKUP_ARCHIVE}" "$S3_DESTINATION" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256 \
    --metadata "backup-type=weekly,database=${DB_NAME},timestamp=${TIMESTAMP},week=${WEEK_NUMBER}" \
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

# Cleanup old backups (retention policy: 52 weeks = 1 year)
log "Cleaning up backups older than ${RETENTION_WEEKS} weeks..."
CUTOFF_DATE=$(date -d "${RETENTION_WEEKS} weeks ago" +%Y%m%d)

aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_weekly_" | \
    while read -r file; do
        FILE_DATE=$(echo "$file" | sed 's/krishiai_weekly_\([0-9]\{8\}\).*/\1/')
        if [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
            log "Deleting old backup: $file"
            aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${file}" --region "$AWS_REGION"
        fi
    done

log "Cleanup completed"

# Export metrics for Prometheus
METRICS_FILE="/var/lib/postgresql/metrics/backup_metrics.prom"
mkdir -p "$(dirname "$METRICS_FILE")"

TOTAL_DURATION=$((BASEBACKUP_DURATION + COMPRESS_DURATION + UPLOAD_DURATION))

cat > "$METRICS_FILE" <<EOF
# HELP krishiai_backup_last_success_timestamp Timestamp of last successful backup
# TYPE krishiai_backup_last_success_timestamp gauge
krishiai_backup_last_success_timestamp{type="weekly"} $(date +%s)

# HELP krishiai_backup_duration_seconds Duration of backup operation
# TYPE krishiai_backup_duration_seconds gauge
krishiai_backup_duration_seconds{type="weekly"} ${TOTAL_DURATION}

# HELP krishiai_backup_size_bytes Size of backup file
# TYPE krishiai_backup_size_bytes gauge
krishiai_backup_size_bytes{type="weekly"} $(stat -f%z "${TEMP_DIR}/${BACKUP_ARCHIVE}" 2>/dev/null || stat -c%s "${TEMP_DIR}/${BACKUP_ARCHIVE}")

# HELP krishiai_backup_upload_duration_seconds Duration of S3 upload
# TYPE krishiai_backup_upload_duration_seconds gauge
krishiai_backup_upload_duration_seconds{type="weekly"} ${UPLOAD_DURATION}
EOF

log "Metrics exported to ${METRICS_FILE}"

# Summary
log "========================================="
log "Weekly full backup completed successfully"
log "Total time: ${TOTAL_DURATION} seconds"
log "  - Base backup: ${BASEBACKUP_DURATION}s"
log "  - Compression: ${COMPRESS_DURATION}s"
log "  - Upload: ${UPLOAD_DURATION}s"
log "Archive: ${BACKUP_ARCHIVE}"
log "S3 location: ${S3_DESTINATION}"
log "========================================="

exit 0
