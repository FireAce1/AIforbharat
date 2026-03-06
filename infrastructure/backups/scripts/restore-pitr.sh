#!/bin/bash
# Point-in-Time Recovery (PITR) Script
# Restores database to a specific point in time using WAL archives
# Usage: ./restore-pitr.sh "2026-01-16 10:30:00"

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
DATA_DIR="/var/lib/postgresql/data"
LOG_FILE="/var/log/postgresql/restore-pitr.log"

# Target recovery time
if [ $# -eq 0 ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    echo "Example: $0 '2026-01-16 10:30:00'"
    exit 1
fi

RECOVERY_TARGET="$1"

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
log "Starting Point-in-Time Recovery (PITR)"
log "Recovery target: ${RECOVERY_TARGET}"
log "========================================="

# Confirmation prompt
echo ""
echo "WARNING: This will restore the database to ${RECOVERY_TARGET}"
echo "Current data will be backed up but the database will be unavailable during restore."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Step 1: Stop PostgreSQL
log "Step 1: Stopping PostgreSQL..."
if command -v pg_ctl >/dev/null 2>&1; then
    pg_ctl stop -D "$DATA_DIR" -m fast || true
else
    log "WARNING: pg_ctl not found, assuming PostgreSQL is managed externally"
fi

# Step 2: Backup current data directory
log "Step 2: Backing up current data directory..."
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP="${DATA_DIR}_backup_${BACKUP_TIMESTAMP}"

if [ -d "$DATA_DIR" ]; then
    mv "$DATA_DIR" "$CURRENT_BACKUP"
    log "Current data backed up to: ${CURRENT_BACKUP}"
else
    log "WARNING: Data directory not found: ${DATA_DIR}"
fi

# Step 3: Find the most recent base backup before recovery target
log "Step 3: Finding appropriate base backup..."

# List all weekly backups
WEEKLY_BACKUPS=$(aws s3 ls "s3://${S3_BUCKET}/weekly/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_weekly_" | \
    sort -r)

# Find the most recent backup before recovery target
RECOVERY_TIMESTAMP=$(date -d "$RECOVERY_TARGET" +%s)
BASE_BACKUP=""

for backup in $WEEKLY_BACKUPS; do
    BACKUP_DATE=$(echo "$backup" | sed 's/krishiai_weekly_\([0-9]\{8\}\)_\([0-9]\{6\}\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
    BACKUP_TIMESTAMP=$(date -d "$BACKUP_DATE" +%s)
    
    if [ "$BACKUP_TIMESTAMP" -le "$RECOVERY_TIMESTAMP" ]; then
        BASE_BACKUP="$backup"
        log "Selected base backup: ${BASE_BACKUP} (${BACKUP_DATE})"
        break
    fi
done

if [ -z "$BASE_BACKUP" ]; then
    error_exit "No suitable base backup found before recovery target"
fi

# Step 4: Download and extract base backup
log "Step 4: Downloading base backup from S3..."
mkdir -p "$RESTORE_DIR"

if aws s3 cp "s3://${S3_BUCKET}/weekly/${BASE_BACKUP}" "${RESTORE_DIR}/${BASE_BACKUP}" \
    --region "$AWS_REGION" \
    --only-show-errors; then
    log "Base backup downloaded successfully"
else
    error_exit "Failed to download base backup"
fi

log "Extracting base backup..."
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

if tar -xzf "${RESTORE_DIR}/${BASE_BACKUP}"; then
    log "Base backup extracted successfully"
else
    error_exit "Failed to extract base backup"
fi

# Step 5: Create recovery configuration
log "Step 5: Creating recovery configuration..."

# Create recovery.signal file (PostgreSQL 12+)
touch "${DATA_DIR}/recovery.signal"

# Create recovery configuration
cat > "${DATA_DIR}/postgresql.auto.conf" <<EOF
# Recovery configuration for PITR
restore_command = 'aws s3 cp s3://${S3_BUCKET}/wal-archive/%f %p --region ${AWS_REGION}'
recovery_target_time = '${RECOVERY_TARGET}'
recovery_target_action = 'promote'
EOF

log "Recovery configuration created"

# Step 6: Start PostgreSQL in recovery mode
log "Step 6: Starting PostgreSQL in recovery mode..."
if command -v pg_ctl >/dev/null 2>&1; then
    pg_ctl start -D "$DATA_DIR" -l "${LOG_FILE}.postgres"
    log "PostgreSQL started in recovery mode"
else
    log "WARNING: pg_ctl not found, please start PostgreSQL manually"
    log "PostgreSQL will automatically enter recovery mode on startup"
fi

# Step 7: Monitor recovery progress
log "Step 7: Monitoring recovery progress..."
log "Waiting for recovery to complete..."

TIMEOUT=3600  # 1 hour timeout
ELAPSED=0
INTERVAL=10

while [ $ELAPSED -lt $TIMEOUT ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        # Check if recovery is complete
        RECOVERY_STATUS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c "SELECT pg_is_in_recovery();" 2>/dev/null || echo "t")
        
        if [ "$RECOVERY_STATUS" = " f" ]; then
            log "Recovery completed successfully!"
            break
        else
            log "Recovery in progress... (${ELAPSED}s elapsed)"
        fi
    else
        log "Waiting for PostgreSQL to start... (${ELAPSED}s elapsed)"
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    error_exit "Recovery timeout after ${TIMEOUT} seconds"
fi

# Step 8: Verify database
log "Step 8: Verifying database..."

# Check database connectivity
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    error_exit "Database verification failed"
fi

# Get database statistics
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "N/A")

log "Database verification successful"
log "  - Tables: ${TABLE_COUNT}"
log "  - Users: ${USER_COUNT}"

# Step 9: Cleanup
log "Step 9: Cleaning up temporary files..."
rm -rf "$RESTORE_DIR"
log "Cleanup completed"

# Summary
log "========================================="
log "Point-in-Time Recovery completed successfully"
log "Database restored to: ${RECOVERY_TARGET}"
log "Previous data backed up to: ${CURRENT_BACKUP}"
log "========================================="
log ""
log "IMPORTANT: Please verify your application data before resuming normal operations"
log "To rollback this restore, stop PostgreSQL and restore from: ${CURRENT_BACKUP}"

exit 0
