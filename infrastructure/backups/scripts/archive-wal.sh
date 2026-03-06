#!/bin/bash
# WAL Archive Script for PostgreSQL
# This script is called by PostgreSQL's archive_command to upload WAL files to S3
# Usage: archive-wal.sh <wal_path> <wal_filename>

set -e  # Exit on error
set -u  # Exit on undefined variable

# Arguments from PostgreSQL
WAL_PATH="$1"      # Full path to WAL file (e.g., /var/lib/postgresql/data/pg_wal/000000010000000000000001)
WAL_FILE="$2"      # WAL filename only (e.g., 000000010000000000000001)

# Configuration from environment variables
S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
S3_PREFIX="${S3_PREFIX:-wal-archive}"
AWS_REGION="${AWS_REGION:-us-east-1}"
LOG_FILE="${LOG_FILE:-/var/log/postgresql/wal-archive.log}"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Validate inputs
if [ -z "$WAL_PATH" ] || [ -z "$WAL_FILE" ]; then
    error_exit "Missing required arguments: WAL_PATH and WAL_FILE"
fi

if [ ! -f "$WAL_PATH" ]; then
    error_exit "WAL file does not exist: $WAL_PATH"
fi

# S3 destination
S3_DESTINATION="s3://${S3_BUCKET}/${S3_PREFIX}/${WAL_FILE}"

log "Starting WAL archive: $WAL_FILE"

# Check if file already exists in S3 (idempotency)
if aws s3 ls "$S3_DESTINATION" --region "$AWS_REGION" >/dev/null 2>&1; then
    log "WAL file already exists in S3: $WAL_FILE (skipping)"
    exit 0
fi

# Upload to S3 with server-side encryption
if aws s3 cp "$WAL_PATH" "$S3_DESTINATION" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA \
    --server-side-encryption AES256 \
    --only-show-errors; then
    
    log "Successfully archived WAL file: $WAL_FILE"
    
    # Verify upload
    if aws s3 ls "$S3_DESTINATION" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "Verified WAL file in S3: $WAL_FILE"
        exit 0
    else
        error_exit "WAL file upload verification failed: $WAL_FILE"
    fi
else
    error_exit "Failed to upload WAL file to S3: $WAL_FILE"
fi
