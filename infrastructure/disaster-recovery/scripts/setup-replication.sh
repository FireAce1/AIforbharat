#!/bin/bash

# Setup PostgreSQL Streaming Replication
# KrishiAI Platform - Disaster Recovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PRIMARY_HOST="${PRIMARY_HOST:-postgres-primary.us-east-1.svc.cluster.local}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
REPLICA_HOST="${REPLICA_HOST:-postgres-replica.us-west-2.svc.cluster.local}"
REPLICA_PORT="${REPLICA_PORT:-5432}"
REPLICATION_USER="${REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${REPLICATION_PASSWORD}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
REPLICATION_SLOT_NAME="${REPLICATION_SLOT_NAME:-replica_slot_1}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PostgreSQL Replication Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Validate required environment variables
if [ -z "$REPLICATION_PASSWORD" ]; then
    echo -e "${RED}Error: REPLICATION_PASSWORD not set${NC}"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}Error: POSTGRES_PASSWORD not set${NC}"
    exit 1
fi

# Step 1: Create replication user on primary
echo -e "${YELLOW}Step 1: Creating replication user on primary...${NC}"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -c "
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$REPLICATION_USER') THEN
        CREATE USER $REPLICATION_USER WITH REPLICATION ENCRYPTED PASSWORD '$REPLICATION_PASSWORD';
    END IF;
END
\$\$;
" || {
    echo -e "${RED}Failed to create replication user${NC}"
    exit 1
}
echo -e "${GREEN}✓ Replication user created${NC}"
echo ""

# Step 2: Create replication slot on primary
echo -e "${YELLOW}Step 2: Creating replication slot on primary...${NC}"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -c "
SELECT pg_create_physical_replication_slot('$REPLICATION_SLOT_NAME');
" 2>/dev/null || {
    echo -e "${YELLOW}Replication slot may already exist, continuing...${NC}"
}
echo -e "${GREEN}✓ Replication slot ready${NC}"
echo ""

# Step 3: Verify primary is ready for replication
echo -e "${YELLOW}Step 3: Verifying primary configuration...${NC}"
WAL_LEVEL=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -t -c "SHOW wal_level;")
MAX_WAL_SENDERS=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -t -c "SHOW max_wal_senders;")

echo "  wal_level: $WAL_LEVEL"
echo "  max_wal_senders: $MAX_WAL_SENDERS"

if [[ "$WAL_LEVEL" != *"replica"* ]]; then
    echo -e "${RED}Error: wal_level must be 'replica' or higher${NC}"
    exit 1
fi

if [ "$MAX_WAL_SENDERS" -lt 1 ]; then
    echo -e "${RED}Error: max_wal_senders must be at least 1${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Primary configuration verified${NC}"
echo ""

# Step 4: Take base backup from primary
echo -e "${YELLOW}Step 4: Taking base backup from primary...${NC}"
echo "This may take several minutes depending on database size..."

# Create temporary directory for base backup
BACKUP_DIR="/tmp/pg_basebackup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

PGPASSWORD=$REPLICATION_PASSWORD pg_basebackup \
    -h $PRIMARY_HOST \
    -p $PRIMARY_PORT \
    -U $REPLICATION_USER \
    -D $BACKUP_DIR \
    -Fp \
    -Xs \
    -P \
    -R \
    --slot=$REPLICATION_SLOT_NAME || {
    echo -e "${RED}Failed to take base backup${NC}"
    rm -rf $BACKUP_DIR
    exit 1
}

echo -e "${GREEN}✓ Base backup completed${NC}"
echo ""

# Step 5: Configure replica
echo -e "${YELLOW}Step 5: Configuring replica...${NC}"

# Create standby.signal file
touch $BACKUP_DIR/standby.signal

# Update postgresql.auto.conf with primary connection info
cat >> $BACKUP_DIR/postgresql.auto.conf <<EOF

# Replication configuration (added by setup-replication.sh)
primary_conninfo = 'host=$PRIMARY_HOST port=$PRIMARY_PORT user=$REPLICATION_USER password=$REPLICATION_PASSWORD sslmode=require application_name=replica1'
primary_slot_name = '$REPLICATION_SLOT_NAME'
EOF

echo -e "${GREEN}✓ Replica configured${NC}"
echo ""

# Step 6: Display next steps
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Copy base backup to replica server:"
echo "   rsync -avz $BACKUP_DIR/ replica-server:/var/lib/postgresql/data/"
echo ""
echo "2. Start PostgreSQL on replica:"
echo "   kubectl rollout restart deployment/postgres-replica"
echo ""
echo "3. Verify replication status on primary:"
echo "   psql -h $PRIMARY_HOST -U $POSTGRES_USER -c 'SELECT * FROM pg_stat_replication;'"
echo ""
echo "4. Check replication lag on replica:"
echo "   psql -h $REPLICA_HOST -U $POSTGRES_USER -c \"SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;\""
echo ""
echo "5. Monitor replication:"
echo "   ./scripts/health-check.sh"
echo ""

# Cleanup
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf $BACKUP_DIR
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

echo -e "${GREEN}Replication setup completed successfully!${NC}"
