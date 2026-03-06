#!/bin/bash
# Restore from Snapshot Script
# Restores database from daily or weekly snapshot
# Usage: ./restore-snapshot.sh <type> <date>
#   type: daily or weekly
#   date: YYYY-MM-DD format

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
DB_HOST="${DB_HOST:-postgres-service}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-krishiai_db}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD}"
export PGPASSWORD

S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"

RESTORE_DIR="/var/lib/postgresql/restore"
LOG_FILE="/var/log/postgresql/restore-snapshot.log"

# Parse arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <type> <date>"
    echo "  type: daily or weekly"
    echo "  date: YYYY-MM-DD"
    echo ""
    echo "Examples:"
    echo "  $0 daily 2026-01-16"
    echo "  $0 weekly 2026-01-12"
    exit 1
fi

BACKUP_TYPE="$1"
BACKUP_DATE="$2"

# Validate backup type
if [ "$BACKUP_TYPE" != "daily" ] && [ "$BACKUP_TYPE" != "weekly" ]; then
    echo "ERROR: Invalid backup type. Must be 'daily' or 'weekly'"
    exit 1
fi

# Validate date format
if ! date -d "$BACKUP_DATE" >/dev/null 2>&1; then
    echo "ERROR: Invalid date format. Use YYYY-MM-DD"
    exit 1
fi

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

log "========================================="
log "Starting Snapshot Restore"
log "Backup type: ${BACKUP_TYPE}"
log "Backup date: ${BACKUP_DATE}"
log "========================================="

# Confirmation prompt
echo ""
echo "WARNING: This will restore the database from ${BACKUP_TYPE} backup on ${BACKUP_DATE}"
echo "Current data will be backed up but the database will be unavailable during restore."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Step 1: Find backup file
log "Step 1: Finding backup file in S3..."

# Convert date to filename format (YYYYMMDD)
FILE_DATE=$(date -d "$BACKUP_DATE" +%Y%m%d)

# List backups for the specified date
S3_PREFIX="$BACKUP_TYPE"
BACKUP_FILES=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "krishiai_${BACKUP_TYPE}_${FILE_DATE}")

if [ -z "$BACKUP_FILES" ]; then
    error_exit "No backup found for ${BACKUP_DATE}"
fi

# Use the first (or only) backup file
BACKUP_FILE=$(echo "$BACKUP_FILES" | head -n 1)
log "Found backup: ${BACKUP_FILE}"

# Step 2: Download backup from S3
log "Step 2: Downloading backup from S3..."
mkdir -p "$RESTORE_DIR"

S3_SOURCE="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"
LOCAL_FILE="${RESTORE_DIR}/${BACKUP_FILE}"

DOWNLOAD_START=$(date +%s)
if aws s3 cp "$S3_SOURCE" "$LOCAL_FILE" \
    --region "$AWS_REGION" \
    --only-show-errors; then
    
    DOWNLOAD_END=$(date +%s)
    DOWNLOAD_DURATION=$((DOWNLOAD_END - DOWNLOAD_START))
    FILE_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
    
    log "Download completed successfully"
    log "Duration: ${DOWNLOAD_DURATION} seconds"
    log "File size: ${FILE_SIZE}"
else
    error_exit "Failed to download backup from S3"
fi

# Step 3: Verify backup file integrity
log "Step 3: Verifying backup file integrity..."

if [ "$BACKUP_TYPE" = "daily" ]; then
    # For daily backups (pg_dump custom format)
    if pg_restore --list "$LOCAL_FILE" >/dev/null 2>&1; then
        log "Backup file integrity verified"
    else
        error_exit "Backup file is corrupted or invalid"
    fi
elif [ "$BACKUP_TYPE" = "weekly" ]; then
    # For weekly backups (tar.gz format)
    if tar -tzf "$LOCAL_FILE" >/dev/null 2>&1; then
        log "Backup file integrity verified"
    else
        error_exit "Backup file is corrupted or invalid"
    fi
fi

# Step 4: Backup current database
log "Step 4: Backing up current database..."
CURRENT_BACKUP="${DB_NAME}_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

if pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --file="${RESTORE_DIR}/${CURRENT_BACKUP}" 2>&1 | tee -a "$LOG_FILE"; then
    
    log "Current database backed up to: ${CURRENT_BACKUP}"
else
    log "WARNING: Failed to backup current database"
fi

# Step 5: Drop and recreate database
log "Step 5: Preparing database for restore..."

# Terminate existing connections
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    2>&1 | tee -a "$LOG_FILE" || true

# Drop database
log "Dropping database: ${DB_NAME}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
    2>&1 | tee -a "$LOG_FILE"

# Recreate database
log "Creating database: ${DB_NAME}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};" \
    2>&1 | tee -a "$LOG_FILE"

# Step 6: Restore backup
log "Step 6: Restoring backup..."

RESTORE_START=$(date +%s)

if [ "$BACKUP_TYPE" = "daily" ]; then
    # Restore from pg_dump custom format
    # --jobs=4 for parallel restore (faster)
    # --no-owner to avoid ownership issues
    # --no-acl to avoid permission issues
    if pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --jobs=4 \
        --no-owner \
        --no-acl \
        --verbose \
        "$LOCAL_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        
        log "Restore completed successfully"
    else
        error_exit "Restore failed"
    fi
    
elif [ "$BACKUP_TYPE" = "weekly" ]; then
    # For weekly backups, we need to stop PostgreSQL and restore the entire data directory
    log "WARNING: Weekly backup restore requires PostgreSQL restart"
    log "This operation should be performed manually or in a maintenance window"
    error_exit "Weekly backup restore not fully automated. Please use restore-pitr.sh instead"
fi

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
log "Restore duration: ${RESTORE_DURATION} seconds"

# Step 7: Verify restored database
log "Step 7: Verifying restored database..."

# Check database connectivity
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    error_exit "Database verification failed"
fi

# Get database statistics
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "N/A")
FARM_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM farms;" 2>/dev/null | tr -d ' ' || echo "N/A")

log "Database verification successful"
log "  - Tables: ${TABLE_COUNT}"
log "  - Users: ${USER_COUNT}"
log "  - Farms: ${FARM_COUNT}"

# Step 8: Analyze database
log "Step 8: Analyzing database for optimal performance..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "ANALYZE;" \
    2>&1 | tee -a "$LOG_FILE"
log "Database analysis completed"

# Step 9: Cleanup
log "Step 9: Cleaning up temporary files..."
rm -f "$LOCAL_FILE"
log "Cleanup completed"

# Summary
TOTAL_TIME=$((DOWNLOAD_DURATION + RESTORE_DURATION))
log "========================================="
log "Snapshot Restore completed successfully"
log "Backup type: ${BACKUP_TYPE}"
log "Backup date: ${BACKUP_DATE}"
log "Total time: ${TOTAL_TIME} seconds"
log "  - Download: ${DOWNLOAD_DURATION}s"
log "  - Restore: ${RESTORE_DURATION}s"
log "Current database backed up to: ${RESTORE_DIR}/${CURRENT_BACKUP}"
log "========================================="
log ""
log "IMPORTANT: Please verify your application data before resuming normal operations"

exit 0
