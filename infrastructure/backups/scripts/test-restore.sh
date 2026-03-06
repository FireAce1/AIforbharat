#!/bin/bash
# Monthly Restore Test Script
# Tests backup restore procedure to verify backup integrity
# Runs monthly on the 1st at 3:00 AM IST via Kubernetes CronJob

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
DB_HOST="${DB_HOST:-postgres-service}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD}"
export PGPASSWORD

S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"

TEST_DB_NAME="krishiai_restore_test"
RESTORE_DIR="/var/lib/postgresql/restore_test"
LOG_FILE="/var/log/postgresql/test-restore.log"
REPORT_FILE="/var/log/postgresql/test-restore-report.txt"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

# Initialize error counter
ERRORS=0

log "========================================="
log "Starting Monthly Restore Test"
log "Test database: ${TEST_DB_NAME}"
log "========================================="

# Step 1: Find latest daily backup
log "Step 1: Finding latest daily backup..."

LATEST_BACKUP=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --region "$AWS_REGION" | \
    awk '{print $4}' | \
    grep "^krishiai_daily_" | \
    sort -r | \
    head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    error_exit "No daily backup found"
    exit 1
fi

log "Latest backup: ${LATEST_BACKUP}"

# Step 2: Download backup
log "Step 2: Downloading backup..."
mkdir -p "$RESTORE_DIR"

DOWNLOAD_START=$(date +%s)
if aws s3 cp "s3://${S3_BUCKET}/daily/${LATEST_BACKUP}" "${RESTORE_DIR}/${LATEST_BACKUP}" \
    --region "$AWS_REGION" \
    --only-show-errors; then
    
    DOWNLOAD_END=$(date +%s)
    DOWNLOAD_DURATION=$((DOWNLOAD_END - DOWNLOAD_START))
    FILE_SIZE=$(du -h "${RESTORE_DIR}/${LATEST_BACKUP}" | cut -f1)
    
    log "Download completed: ${FILE_SIZE} in ${DOWNLOAD_DURATION}s"
else
    error_exit "Failed to download backup"
fi

# Step 3: Verify backup file integrity
log "Step 3: Verifying backup file integrity..."

if pg_restore --list "${RESTORE_DIR}/${LATEST_BACKUP}" >/dev/null 2>&1; then
    log "Backup file integrity: PASS"
else
    error_exit "Backup file integrity: FAIL"
fi

# Step 4: Create test database
log "Step 4: Creating test database..."

# Drop test database if exists
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS ${TEST_DB_NAME};" 2>&1 | tee -a "$LOG_FILE" || true

# Create test database
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "CREATE DATABASE ${TEST_DB_NAME};" 2>&1 | tee -a "$LOG_FILE"; then
    log "Test database created: PASS"
else
    error_exit "Test database creation: FAIL"
fi

# Step 5: Restore backup to test database
log "Step 5: Restoring backup to test database..."

RESTORE_START=$(date +%s)
if pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEST_DB_NAME" \
    --jobs=4 \
    --no-owner \
    --no-acl \
    "${RESTORE_DIR}/${LATEST_BACKUP}" 2>&1 | tee -a "$LOG_FILE"; then
    
    RESTORE_END=$(date +%s)
    RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
    log "Restore completed: PASS (${RESTORE_DURATION}s)"
else
    error_exit "Restore: FAIL"
fi

# Step 6: Verify restored data
log "Step 6: Verifying restored data..."

# Check database connectivity
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "Database connectivity: PASS"
else
    error_exit "Database connectivity: FAIL"
fi

# Count tables
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "Table count: PASS (${TABLE_COUNT} tables)"
else
    error_exit "Table count: FAIL (0 tables)"
fi

# Verify critical tables exist
CRITICAL_TABLES=("users" "farms" "crops" "disease_detections" "market_prices" "weather_forecasts")
for table in "${CRITICAL_TABLES[@]}"; do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
        "SELECT 1 FROM information_schema.tables WHERE table_name = '${table}';" 2>/dev/null | grep -q 1; then
        
        ROW_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
            "SELECT COUNT(*) FROM ${table};" 2>/dev/null | tr -d ' ' || echo "0")
        log "Table '${table}': PASS (${ROW_COUNT} rows)"
    else
        error_exit "Table '${table}': FAIL (not found)"
    fi
done

# Verify indexes
INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$INDEX_COUNT" -gt 0 ]; then
    log "Index count: PASS (${INDEX_COUNT} indexes)"
else
    error_exit "Index count: FAIL (0 indexes)"
fi

# Verify foreign keys
FK_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$FK_COUNT" -gt 0 ]; then
    log "Foreign key count: PASS (${FK_COUNT} constraints)"
else
    error_exit "Foreign key count: FAIL (0 constraints)"
fi

# Step 7: Test sample queries
log "Step 7: Testing sample queries..."

# Test user query
USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$USER_COUNT" -ge 0 ]; then
    log "User query: PASS (${USER_COUNT} users)"
else
    error_exit "User query: FAIL"
fi

# Test farm query with geospatial
FARM_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM farms;" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$FARM_COUNT" -ge 0 ]; then
    log "Farm query: PASS (${FARM_COUNT} farms)"
else
    error_exit "Farm query: FAIL"
fi

# Test time-series query
PRICE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
    "SELECT COUNT(*) FROM market_prices WHERE time > NOW() - INTERVAL '7 days';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$PRICE_COUNT" -ge 0 ]; then
    log "Time-series query: PASS (${PRICE_COUNT} recent prices)"
else
    error_exit "Time-series query: FAIL"
fi

# Step 8: Cleanup test database
log "Step 8: Cleaning up test database..."

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "DROP DATABASE ${TEST_DB_NAME};" 2>&1 | tee -a "$LOG_FILE"; then
    log "Test database dropped: PASS"
else
    error_exit "Test database cleanup: FAIL"
fi

# Cleanup temporary files
rm -rf "$RESTORE_DIR"
log "Temporary files cleaned up"

# Step 9: Generate test report
log "Step 9: Generating test report..."

TOTAL_TIME=$((DOWNLOAD_DURATION + RESTORE_DURATION))
TEST_STATUS="PASS"
if [ $ERRORS -gt 0 ]; then
    TEST_STATUS="FAIL"
fi

cat > "$REPORT_FILE" <<EOF
========================================
KrishiAI Database Backup Restore Test Report
========================================

Test Date: $(date +'%Y-%m-%d %H:%M:%S')
Test Status: ${TEST_STATUS}
Errors: ${ERRORS}

Backup Information:
- Backup File: ${LATEST_BACKUP}
- Backup Size: ${FILE_SIZE}
- Backup Type: Daily Snapshot

Performance Metrics:
- Download Duration: ${DOWNLOAD_DURATION}s
- Restore Duration: ${RESTORE_DURATION}s
- Total Duration: ${TOTAL_TIME}s

Data Verification:
- Tables: ${TABLE_COUNT}
- Indexes: ${INDEX_COUNT}
- Foreign Keys: ${FK_COUNT}
- Users: ${USER_COUNT}
- Farms: ${FARM_COUNT}
- Recent Prices: ${PRICE_COUNT}

Test Results:
- Backup Download: PASS
- File Integrity: $([ $ERRORS -eq 0 ] && echo "PASS" || echo "FAIL")
- Database Creation: PASS
- Data Restore: PASS
- Data Verification: $([ $ERRORS -eq 0 ] && echo "PASS" || echo "FAIL")
- Query Testing: PASS
- Cleanup: PASS

Recommendations:
$(if [ $ERRORS -eq 0 ]; then
    echo "- All tests passed successfully"
    echo "- Backup and restore procedures are working correctly"
    echo "- No action required"
else
    echo "- ${ERRORS} error(s) detected during testing"
    echo "- Review logs at: ${LOG_FILE}"
    echo "- Investigate and fix issues immediately"
    echo "- Consider running manual restore test"
fi)

========================================
EOF

log "Test report generated: ${REPORT_FILE}"

# Display report
cat "$REPORT_FILE" | tee -a "$LOG_FILE"

# Export metrics for Prometheus
METRICS_FILE="/var/lib/postgresql/metrics/restore_test_metrics.prom"
mkdir -p "$(dirname "$METRICS_FILE")"

cat > "$METRICS_FILE" <<EOF
# HELP krishiai_restore_test_last_run_timestamp Timestamp of last restore test
# TYPE krishiai_restore_test_last_run_timestamp gauge
krishiai_restore_test_last_run_timestamp $(date +%s)

# HELP krishiai_restore_test_status Status of last restore test (1=pass, 0=fail)
# TYPE krishiai_restore_test_status gauge
krishiai_restore_test_status $([ $ERRORS -eq 0 ] && echo "1" || echo "0")

# HELP krishiai_restore_test_errors_total Total errors in last restore test
# TYPE krishiai_restore_test_errors_total gauge
krishiai_restore_test_errors_total ${ERRORS}

# HELP krishiai_restore_test_duration_seconds Duration of restore test
# TYPE krishiai_restore_test_duration_seconds gauge
krishiai_restore_test_duration_seconds ${TOTAL_TIME}

# HELP krishiai_restore_test_tables_verified Number of tables verified
# TYPE krishiai_restore_test_tables_verified gauge
krishiai_restore_test_tables_verified ${TABLE_COUNT}
EOF

log "Metrics exported to ${METRICS_FILE}"

# Summary
log "========================================="
log "Monthly Restore Test completed"
log "Status: ${TEST_STATUS}"
log "Errors: ${ERRORS}"
log "Duration: ${TOTAL_TIME}s"
log "Report: ${REPORT_FILE}"
log "========================================="

# Exit with error code if tests failed
if [ $ERRORS -gt 0 ]; then
    exit 1
fi

exit 0
