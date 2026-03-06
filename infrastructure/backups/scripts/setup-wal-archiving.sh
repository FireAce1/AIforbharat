#!/bin/bash
# Setup WAL Archiving Script
# Configures PostgreSQL for continuous archiving and point-in-time recovery

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
POSTGRES_POD="${POSTGRES_POD:-postgres-0}"
NAMESPACE="${NAMESPACE:-default}"
POSTGRES_DATA_DIR="/var/lib/postgresql/data"
BACKUP_CONFIG_FILE="../postgresql.conf.backup"
ARCHIVE_SCRIPT="../scripts/archive-wal.sh"

echo "========================================="
echo "PostgreSQL WAL Archiving Setup"
echo "========================================="
echo ""

# Check if running in Kubernetes
if command -v kubectl >/dev/null 2>&1; then
    echo "Kubernetes environment detected"
    USE_KUBECTL=true
else
    echo "Local environment detected"
    USE_KUBECTL=false
fi

# Step 1: Verify PostgreSQL is running
echo "Step 1: Verifying PostgreSQL is running..."
if [ "$USE_KUBECTL" = true ]; then
    if kubectl get pod "$POSTGRES_POD" -n "$NAMESPACE" >/dev/null 2>&1; then
        echo "✓ PostgreSQL pod found: $POSTGRES_POD"
    else
        echo "✗ PostgreSQL pod not found: $POSTGRES_POD"
        exit 1
    fi
else
    if pg_isready >/dev/null 2>&1; then
        echo "✓ PostgreSQL is running"
    else
        echo "✗ PostgreSQL is not running"
        exit 1
    fi
fi

# Step 2: Backup current configuration
echo ""
echo "Step 2: Backing up current PostgreSQL configuration..."
if [ "$USE_KUBECTL" = true ]; then
    kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
        cp "${POSTGRES_DATA_DIR}/postgresql.conf" "${POSTGRES_DATA_DIR}/postgresql.conf.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Configuration backed up"
else
    cp "${POSTGRES_DATA_DIR}/postgresql.conf" "${POSTGRES_DATA_DIR}/postgresql.conf.backup.$(date +%Y%m%d_%H%M%S)"
    echo "✓ Configuration backed up"
fi

# Step 3: Copy archive script to PostgreSQL container
echo ""
echo "Step 3: Installing WAL archive script..."
if [ "$USE_KUBECTL" = true ]; then
    kubectl cp "$ARCHIVE_SCRIPT" "${NAMESPACE}/${POSTGRES_POD}:/usr/local/bin/archive-wal.sh"
    kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- chmod +x /usr/local/bin/archive-wal.sh
    echo "✓ Archive script installed"
else
    cp "$ARCHIVE_SCRIPT" /usr/local/bin/archive-wal.sh
    chmod +x /usr/local/bin/archive-wal.sh
    echo "✓ Archive script installed"
fi

# Step 4: Update PostgreSQL configuration
echo ""
echo "Step 4: Updating PostgreSQL configuration..."

# Read backup configuration
if [ ! -f "$BACKUP_CONFIG_FILE" ]; then
    echo "✗ Backup configuration file not found: $BACKUP_CONFIG_FILE"
    exit 1
fi

# Apply configuration changes
if [ "$USE_KUBECTL" = true ]; then
    # Copy configuration file to pod
    kubectl cp "$BACKUP_CONFIG_FILE" "${NAMESPACE}/${POSTGRES_POD}:${POSTGRES_DATA_DIR}/postgresql.conf.new"
    
    # Merge with existing configuration
    kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- bash -c "
        cat ${POSTGRES_DATA_DIR}/postgresql.conf.new >> ${POSTGRES_DATA_DIR}/postgresql.conf
        rm ${POSTGRES_DATA_DIR}/postgresql.conf.new
    "
    echo "✓ Configuration updated"
else
    cat "$BACKUP_CONFIG_FILE" >> "${POSTGRES_DATA_DIR}/postgresql.conf"
    echo "✓ Configuration updated"
fi

# Step 5: Verify configuration
echo ""
echo "Step 5: Verifying configuration..."
if [ "$USE_KUBECTL" = true ]; then
    WAL_LEVEL=$(kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
        psql -U postgres -t -c "SHOW wal_level;" | tr -d ' ')
    ARCHIVE_MODE=$(kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
        psql -U postgres -t -c "SHOW archive_mode;" | tr -d ' ')
else
    WAL_LEVEL=$(psql -U postgres -t -c "SHOW wal_level;" | tr -d ' ')
    ARCHIVE_MODE=$(psql -U postgres -t -c "SHOW archive_mode;" | tr -d ' ')
fi

echo "Current settings:"
echo "  - wal_level: $WAL_LEVEL"
echo "  - archive_mode: $ARCHIVE_MODE"

# Step 6: Restart PostgreSQL
echo ""
echo "Step 6: Restarting PostgreSQL to apply changes..."
echo "WARNING: This will cause a brief downtime"
read -p "Continue with restart? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Setup cancelled. Please restart PostgreSQL manually to apply changes."
    exit 0
fi

if [ "$USE_KUBECTL" = true ]; then
    kubectl delete pod "$POSTGRES_POD" -n "$NAMESPACE"
    echo "Waiting for pod to restart..."
    kubectl wait --for=condition=Ready pod/"$POSTGRES_POD" -n "$NAMESPACE" --timeout=300s
    echo "✓ PostgreSQL restarted"
else
    pg_ctl restart -D "$POSTGRES_DATA_DIR"
    echo "✓ PostgreSQL restarted"
fi

# Step 7: Verify WAL archiving is working
echo ""
echo "Step 7: Verifying WAL archiving..."
sleep 5  # Wait for archiving to start

if [ "$USE_KUBECTL" = true ]; then
    ARCHIVE_STATUS=$(kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
        psql -U postgres -t -c "SELECT archived_count, failed_count FROM pg_stat_archiver;" | tr -d ' ')
else
    ARCHIVE_STATUS=$(psql -U postgres -t -c "SELECT archived_count, failed_count FROM pg_stat_archiver;" | tr -d ' ')
fi

echo "Archive status: $ARCHIVE_STATUS"

# Force a WAL switch to test archiving
if [ "$USE_KUBECTL" = true ]; then
    kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
        psql -U postgres -c "SELECT pg_switch_wal();"
else
    psql -U postgres -c "SELECT pg_switch_wal();"
fi

echo "Waiting for WAL file to be archived..."
sleep 10

# Check S3 for archived WAL files
if command -v aws >/dev/null 2>&1; then
    S3_BUCKET="${S3_BUCKET:-krishiai-db-backups}"
    AWS_REGION="${AWS_REGION:-us-east-1}"
    
    WAL_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/wal-archive/" --region "$AWS_REGION" | wc -l)
    
    if [ "$WAL_COUNT" -gt 0 ]; then
        echo "✓ WAL archiving is working ($WAL_COUNT files in S3)"
    else
        echo "⚠ No WAL files found in S3 yet (may take a few minutes)"
    fi
else
    echo "⚠ AWS CLI not found, cannot verify S3 upload"
fi

# Summary
echo ""
echo "========================================="
echo "WAL Archiving Setup Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Deploy backup CronJobs: kubectl apply -f k8s/backup-cronjob.yaml"
echo "2. Create S3 credentials secret: kubectl create secret generic backup-s3-credentials ..."
echo "3. Monitor backup logs: kubectl logs -l app=database-backup"
echo "4. Test restore procedure: ./restore-pitr.sh '2026-01-16 10:30:00'"
echo ""

exit 0
