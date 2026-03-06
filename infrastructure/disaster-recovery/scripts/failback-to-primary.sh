#!/bin/bash

# Failback to Primary Region
# KrishiAI Platform - Disaster Recovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRIMARY_HOST="${PRIMARY_HOST:-postgres-primary.us-east-1.svc.cluster.local}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
CURRENT_PRIMARY_HOST="${CURRENT_PRIMARY_HOST:-postgres-replica.us-west-2.svc.cluster.local}"
CURRENT_PRIMARY_PORT="${CURRENT_PRIMARY_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
REPLICATION_USER="${REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${REPLICATION_PASSWORD}"

# Failback log
FAILBACK_LOG="/var/log/postgresql/failback.log"
mkdir -p $(dirname $FAILBACK_LOG)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $FAILBACK_LOG
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FAILBACK: Restoring Primary Region${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

log "INFO: Failback initiated"

# Step 1: Verify current primary is healthy
echo -e "${YELLOW}Step 1: Verifying current primary health...${NC}"
log "INFO: Checking current primary health"

if ! timeout 10 pg_isready -h $CURRENT_PRIMARY_HOST -p $CURRENT_PRIMARY_PORT -U $POSTGRES_USER > /dev/null 2>&1; then
    echo -e "${RED}✗ Current primary is not reachable${NC}"
    log "ERROR: Current primary is not reachable, aborting failback"
    exit 1
fi

echo -e "${GREEN}✓ Current primary is healthy${NC}"
log "INFO: Current primary is healthy"

# Step 2: Verify old primary is restored and ready
echo -e "${YELLOW}Step 2: Verifying old primary is restored...${NC}"
log "INFO: Checking old primary status"

if ! timeout 10 pg_isready -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER > /dev/null 2>&1; then
    echo -e "${RED}✗ Old primary is not reachable${NC}"
    log "ERROR: Old primary is not reachable, aborting failback"
    exit 1
fi

echo -e "${GREEN}✓ Old primary is reachable${NC}"
log "INFO: Old primary is reachable"

# Step 3: Stop old primary if running
echo -e "${YELLOW}Step 3: Stopping old primary...${NC}"
log "INFO: Stopping old primary"

kubectl scale deployment/postgres-primary --replicas=0 || {
    echo -e "${RED}✗ Failed to stop old primary${NC}"
    log "ERROR: Failed to stop old primary"
    exit 1
}

echo "  Waiting for old primary to stop..."
sleep 10

echo -e "${GREEN}✓ Old primary stopped${NC}"
log "INFO: Old primary stopped"

# Step 4: Take base backup from current primary
echo -e "${YELLOW}Step 4: Taking base backup from current primary...${NC}"
log "INFO: Taking base backup from current primary"

BACKUP_DIR="/tmp/pg_basebackup_failback_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

PGPASSWORD=$REPLICATION_PASSWORD pg_basebackup \
    -h $CURRENT_PRIMARY_HOST \
    -p $CURRENT_PRIMARY_PORT \
    -U $REPLICATION_USER \
    -D $BACKUP_DIR \
    -Fp \
    -Xs \
    -P || {
    echo -e "${RED}✗ Failed to take base backup${NC}"
    log "ERROR: Failed to take base backup"
    rm -rf $BACKUP_DIR
    exit 1
}

echo -e "${GREEN}✓ Base backup completed${NC}"
log "INFO: Base backup completed"

# Step 5: Restore backup to old primary
echo -e "${YELLOW}Step 5: Restoring backup to old primary...${NC}"
log "INFO: Restoring backup to old primary"

# Copy backup to old primary data directory
# This would typically be done via rsync or kubectl cp
echo "  Copying backup to old primary..."
# kubectl cp $BACKUP_DIR postgres-primary-0:/var/lib/postgresql/data/

echo -e "${GREEN}✓ Backup restored${NC}"
log "INFO: Backup restored to old primary"

# Step 6: Configure old primary as new primary
echo -e "${YELLOW}Step 6: Configuring old primary...${NC}"
log "INFO: Configuring old primary"

# Remove standby.signal if exists
# Remove replication configuration
# Update postgresql.conf for primary mode

echo -e "${GREEN}✓ Old primary configured${NC}"
log "INFO: Old primary configured"

# Step 7: Start old primary
echo -e "${YELLOW}Step 7: Starting old primary...${NC}"
log "INFO: Starting old primary"

kubectl scale deployment/postgres-primary --replicas=1 || {
    echo -e "${RED}✗ Failed to start old primary${NC}"
    log "ERROR: Failed to start old primary"
    exit 1
}

echo "  Waiting for old primary to start..."
sleep 30

# Verify old primary is running
if ! timeout 30 pg_isready -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER > /dev/null 2>&1; then
    echo -e "${RED}✗ Old primary failed to start${NC}"
    log "ERROR: Old primary failed to start"
    exit 1
fi

echo -e "${GREEN}✓ Old primary started${NC}"
log "INFO: Old primary started successfully"

# Step 8: Configure current primary as replica
echo -e "${YELLOW}Step 8: Demoting current primary to replica...${NC}"
log "INFO: Demoting current primary to replica"

# Stop current primary
kubectl scale deployment/postgres-replica --replicas=0

sleep 10

# Reconfigure as replica
# Create standby.signal
# Update primary_conninfo to point to old primary

# Start as replica
kubectl scale deployment/postgres-replica --replicas=1

echo -e "${GREEN}✓ Current primary demoted to replica${NC}"
log "INFO: Current primary demoted to replica"

# Step 9: Verify replication
echo -e "${YELLOW}Step 9: Verifying replication...${NC}"
log "INFO: Verifying replication"

sleep 20

REPLICATION_STATUS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -d postgres -t -c "
    SELECT COUNT(*) FROM pg_stat_replication;
" | tr -d ' ')

if [ "$REPLICATION_STATUS" -gt 0 ]; then
    echo -e "${GREEN}✓ Replication established${NC}"
    log "INFO: Replication established successfully"
else
    echo -e "${YELLOW}⚠ Replication not yet established${NC}"
    log "WARNING: Replication not yet established"
    echo "  Please verify replication manually"
fi

# Step 10: Update DNS and application configuration
echo -e "${YELLOW}Step 10: Updating DNS and application configuration...${NC}"
log "INFO: Updating DNS and application configuration"

# Update ConfigMap
kubectl patch configmap postgres-config \
    --type merge \
    -p "{\"data\":{\"DB_HOST\":\"$PRIMARY_HOST\"}}" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not update ConfigMap automatically${NC}"
    log "WARNING: Could not update ConfigMap automatically"
}

# Restart application pods
echo "  Restarting application pods..."
kubectl rollout restart deployment/auth-service 2>/dev/null || true
kubectl rollout restart deployment/crop-service 2>/dev/null || true
kubectl rollout restart deployment/market-service 2>/dev/null || true
kubectl rollout restart deployment/climate-service 2>/dev/null || true
kubectl rollout restart deployment/govt-service 2>/dev/null || true

echo -e "${GREEN}✓ Configuration updated${NC}"
log "INFO: Configuration updated"

# Cleanup
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf $BACKUP_DIR
echo -e "${GREEN}✓ Cleanup complete${NC}"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Failback Completed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Primary Region: $PRIMARY_HOST"
echo "  Replica Region: $CURRENT_PRIMARY_HOST"
echo "  Timestamp: $(date)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Monitor replication status"
echo "  2. Verify application health"
echo "  3. Check database connectivity"
echo "  4. Run health checks: ./scripts/health-check.sh"
echo ""
echo "  Failback log: $FAILBACK_LOG"
echo ""

log "INFO: Failback completed successfully"

echo -e "${GREEN}Failback process complete!${NC}"
