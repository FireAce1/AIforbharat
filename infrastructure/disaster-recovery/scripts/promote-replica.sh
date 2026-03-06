#!/bin/bash

# Promote Replica to Primary (Failover)
# KrishiAI Platform - Disaster Recovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPLICA_HOST="${REPLICA_HOST:-postgres-replica.us-west-2.svc.cluster.local}"
REPLICA_PORT="${REPLICA_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
DNS_UPDATE_SCRIPT="${DNS_UPDATE_SCRIPT:-/usr/local/bin/update-dns.sh}"
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK}"

# Failover log
FAILOVER_LOG="/var/log/postgresql/failover.log"
mkdir -p $(dirname $FAILOVER_LOG)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $FAILOVER_LOG
}

echo -e "${RED}========================================${NC}"
echo -e "${RED}FAILOVER: Promoting Replica to Primary${NC}"
echo -e "${RED}========================================${NC}"
echo ""

log "INFO: Failover initiated"

# Step 1: Verify replica is healthy
echo -e "${YELLOW}Step 1: Verifying replica health...${NC}"
log "INFO: Checking replica health"

if ! timeout 10 pg_isready -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER > /dev/null 2>&1; then
    echo -e "${RED}✗ Replica is not reachable${NC}"
    log "ERROR: Replica is not reachable, aborting failover"
    exit 1
fi

echo -e "${GREEN}✓ Replica is reachable${NC}"
log "INFO: Replica is reachable"

# Step 2: Check if replica is in recovery mode
echo -e "${YELLOW}Step 2: Checking replica status...${NC}"
log "INFO: Checking if replica is in recovery mode"

IN_RECOVERY=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER -d postgres -t -c "SELECT pg_is_in_recovery();" | tr -d ' ')

if [ "$IN_RECOVERY" != "t" ]; then
    echo -e "${RED}✗ Replica is not in recovery mode (already promoted?)${NC}"
    log "ERROR: Replica is not in recovery mode, aborting failover"
    exit 1
fi

echo -e "${GREEN}✓ Replica is in recovery mode${NC}"
log "INFO: Replica is in recovery mode"

# Step 3: Check replication lag
echo -e "${YELLOW}Step 3: Checking replication lag...${NC}"
log "INFO: Checking replication lag"

LAG=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER -d postgres -t -c "
    SELECT COALESCE(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())), 0);
" | tr -d ' ')

echo "  Replication lag: ${LAG}s"
log "INFO: Replication lag: ${LAG}s"

if (( $(echo "$LAG > 300" | bc -l) )); then
    echo -e "${YELLOW}⚠ Warning: Replication lag exceeds 5 minutes${NC}"
    log "WARNING: Replication lag exceeds 5 minutes"
    
    read -p "Continue with failover? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Failover aborted by user"
        log "INFO: Failover aborted by user due to high replication lag"
        exit 1
    fi
fi

# Step 4: Promote replica
echo -e "${YELLOW}Step 4: Promoting replica to primary...${NC}"
log "INFO: Promoting replica to primary"

# Method 1: Using promote trigger file
echo "  Creating promote trigger file..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER -d postgres -c "
    SELECT pg_promote();
" || {
    echo -e "${RED}✗ Failed to promote replica${NC}"
    log "ERROR: Failed to promote replica"
    exit 1
}

# Wait for promotion to complete
echo "  Waiting for promotion to complete..."
sleep 5

# Verify promotion
for i in {1..30}; do
    IN_RECOVERY=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER -d postgres -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')
    
    if [ "$IN_RECOVERY" = "f" ]; then
        echo -e "${GREEN}✓ Replica promoted to primary${NC}"
        log "INFO: Replica successfully promoted to primary"
        break
    fi
    
    echo "  Waiting for promotion... ($i/30)"
    sleep 2
done

if [ "$IN_RECOVERY" != "f" ]; then
    echo -e "${RED}✗ Promotion did not complete in time${NC}"
    log "ERROR: Promotion did not complete in time"
    exit 1
fi

# Step 5: Update DNS records
echo -e "${YELLOW}Step 5: Updating DNS records...${NC}"
log "INFO: Updating DNS records"

if [ -f "$DNS_UPDATE_SCRIPT" ]; then
    if $DNS_UPDATE_SCRIPT $REPLICA_HOST; then
        echo -e "${GREEN}✓ DNS records updated${NC}"
        log "INFO: DNS records updated successfully"
    else
        echo -e "${RED}✗ Failed to update DNS records${NC}"
        log "ERROR: Failed to update DNS records"
        echo "  Manual intervention required!"
    fi
else
    echo -e "${YELLOW}⚠ DNS update script not found${NC}"
    log "WARNING: DNS update script not found at $DNS_UPDATE_SCRIPT"
    echo "  Please update DNS manually to point to: $REPLICA_HOST"
fi

# Step 6: Update application configuration
echo -e "${YELLOW}Step 6: Updating application configuration...${NC}"
log "INFO: Updating application configuration"

# Update Kubernetes ConfigMap
kubectl patch configmap postgres-config \
    --type merge \
    -p "{\"data\":{\"DB_HOST\":\"$REPLICA_HOST\"}}" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not update ConfigMap automatically${NC}"
    log "WARNING: Could not update ConfigMap automatically"
    echo "  Please update manually: kubectl edit configmap postgres-config"
}

# Restart application pods to pick up new configuration
echo "  Restarting application pods..."
kubectl rollout restart deployment/auth-service 2>/dev/null || true
kubectl rollout restart deployment/crop-service 2>/dev/null || true
kubectl rollout restart deployment/market-service 2>/dev/null || true
kubectl rollout restart deployment/climate-service 2>/dev/null || true
kubectl rollout restart deployment/govt-service 2>/dev/null || true

echo -e "${GREEN}✓ Application configuration updated${NC}"
log "INFO: Application configuration updated"

# Step 7: Send notifications
echo -e "${YELLOW}Step 7: Sending notifications...${NC}"
log "INFO: Sending notifications"

if [ ! -z "$NOTIFICATION_WEBHOOK" ]; then
    curl -X POST $NOTIFICATION_WEBHOOK \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"🚨 FAILOVER ALERT: Replica promoted to primary\",
            \"details\": {
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
                \"new_primary\": \"$REPLICA_HOST\",
                \"replication_lag\": \"${LAG}s\"
            }
        }" 2>/dev/null || {
        echo -e "${YELLOW}⚠ Failed to send notification${NC}"
        log "WARNING: Failed to send notification webhook"
    }
    echo -e "${GREEN}✓ Notifications sent${NC}"
    log "INFO: Notifications sent"
else
    echo -e "${YELLOW}⚠ Notification webhook not configured${NC}"
    log "WARNING: Notification webhook not configured"
fi

# Step 8: Export metrics
echo -e "${YELLOW}Step 8: Exporting metrics...${NC}"
log "INFO: Exporting failover metrics"

METRICS_FILE="/var/lib/postgresql/metrics/failover.prom"
mkdir -p $(dirname $METRICS_FILE)

cat > $METRICS_FILE <<EOF
# HELP krishiai_dr_last_failover_timestamp Unix timestamp of last failover
# TYPE krishiai_dr_last_failover_timestamp gauge
krishiai_dr_last_failover_timestamp $(date +%s)

# HELP krishiai_dr_failover_count_total Total number of failovers
# TYPE krishiai_dr_failover_count_total counter
krishiai_dr_failover_count_total $(( $(cat /var/lib/postgresql/failover_count 2>/dev/null || echo 0) + 1 ))
EOF

# Increment failover counter
echo $(( $(cat /var/lib/postgresql/failover_count 2>/dev/null || echo 0) + 1 )) > /var/lib/postgresql/failover_count

echo -e "${GREEN}✓ Metrics exported${NC}"
log "INFO: Metrics exported"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Failover Completed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  New Primary: $REPLICA_HOST"
echo "  Replication Lag at Failover: ${LAG}s"
echo "  Timestamp: $(date)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Monitor application health"
echo "  2. Verify database connectivity"
echo "  3. Check for any errors in application logs"
echo "  4. Investigate primary failure cause"
echo "  5. Plan failback when primary is restored"
echo ""
echo "  Failover log: $FAILOVER_LOG"
echo ""

log "INFO: Failover completed successfully"

echo -e "${GREEN}Failover process complete!${NC}"
