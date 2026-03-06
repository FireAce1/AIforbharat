#!/bin/bash

# Database Health Check Script
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
REPLICA_HOST="${REPLICA_HOST:-postgres-replica.us-west-2.svc.cluster.local}"
REPLICA_PORT="${REPLICA_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-5}"
REPLICATION_LAG_THRESHOLD="${REPLICATION_LAG_THRESHOLD:-300}" # 5 minutes in seconds

# Metrics file for Prometheus
METRICS_FILE="${METRICS_FILE:-/var/lib/postgresql/metrics/health_check.prom}"

# Initialize metrics
mkdir -p $(dirname $METRICS_FILE)
> $METRICS_FILE

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Health Check${NC}"
echo -e "${BLUE}$(date)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check database connectivity
check_connectivity() {
    local host=$1
    local port=$2
    local name=$3
    
    echo -e "${YELLOW}Checking $name connectivity...${NC}"
    
    if timeout $HEALTH_CHECK_TIMEOUT pg_isready -h $host -p $port -U $POSTGRES_USER > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is reachable${NC}"
        echo "krishiai_dr_${name}_health_status 1" >> $METRICS_FILE
        return 0
    else
        echo -e "${RED}✗ $name is unreachable${NC}"
        echo "krishiai_dr_${name}_health_status 0" >> $METRICS_FILE
        return 1
    fi
}

# Function to check query execution
check_query_execution() {
    local host=$1
    local port=$2
    local name=$3
    
    echo -e "${YELLOW}Checking $name query execution...${NC}"
    
    local start_time=$(date +%s.%N)
    if PGPASSWORD=$POSTGRES_PASSWORD timeout $HEALTH_CHECK_TIMEOUT psql -h $host -p $port -U $POSTGRES_USER -d postgres -t -c "SELECT 1;" > /dev/null 2>&1; then
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc)
        echo -e "${GREEN}✓ $name query execution successful (${duration}s)${NC}"
        echo "krishiai_dr_health_check_duration_seconds{instance=\"$name\"} $duration" >> $METRICS_FILE
        return 0
    else
        echo -e "${RED}✗ $name query execution failed${NC}"
        return 1
    fi
}

# Function to check replication status
check_replication_status() {
    echo -e "${YELLOW}Checking replication status...${NC}"
    
    # Check on primary
    local replication_info=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -p $PRIMARY_PORT -U $POSTGRES_USER -d postgres -t -c "
        SELECT 
            application_name,
            state,
            sync_state,
            EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds
        FROM pg_stat_replication;
    " 2>/dev/null)
    
    if [ -z "$replication_info" ]; then
        echo -e "${RED}✗ No replication connections found${NC}"
        echo "krishiai_dr_replication_lag_seconds -1" >> $METRICS_FILE
        return 1
    fi
    
    echo "$replication_info" | while read -r line; do
        if [ ! -z "$line" ]; then
            echo "  $line"
        fi
    done
    
    # Get replication lag
    local lag=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -p $REPLICA_PORT -U $POSTGRES_USER -d postgres -t -c "
        SELECT COALESCE(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())), 0) AS lag_seconds;
    " 2>/dev/null | tr -d ' ')
    
    if [ ! -z "$lag" ]; then
        echo "  Replication lag: ${lag}s"
        echo "krishiai_dr_replication_lag_seconds $lag" >> $METRICS_FILE
        
        # Check if lag exceeds threshold
        if (( $(echo "$lag > $REPLICATION_LAG_THRESHOLD" | bc -l) )); then
            echo -e "${RED}✗ Replication lag exceeds threshold (${REPLICATION_LAG_THRESHOLD}s)${NC}"
            return 1
        else
            echo -e "${GREEN}✓ Replication lag within acceptable range${NC}"
            return 0
        fi
    else
        echo -e "${RED}✗ Could not determine replication lag${NC}"
        echo "krishiai_dr_replication_lag_seconds -1" >> $METRICS_FILE
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    local host=$1
    local port=$2
    local name=$3
    
    echo -e "${YELLOW}Checking $name disk space...${NC}"
    
    local disk_usage=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $host -p $port -U $POSTGRES_USER -d postgres -t -c "
        SELECT pg_database_size('postgres') / (1024*1024*1024.0) AS size_gb;
    " 2>/dev/null | tr -d ' ')
    
    if [ ! -z "$disk_usage" ]; then
        echo "  Database size: ${disk_usage} GB"
        echo "krishiai_dr_database_size_bytes{instance=\"$name\"} $(echo "$disk_usage * 1024 * 1024 * 1024" | bc)" >> $METRICS_FILE
        echo -e "${GREEN}✓ Disk space check complete${NC}"
        return 0
    else
        echo -e "${RED}✗ Could not check disk space${NC}"
        return 1
    fi
}

# Function to check if database is in recovery mode
check_recovery_mode() {
    local host=$1
    local port=$2
    local name=$3
    
    echo -e "${YELLOW}Checking $name recovery mode...${NC}"
    
    local in_recovery=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $host -p $port -U $POSTGRES_USER -d postgres -t -c "
        SELECT pg_is_in_recovery();
    " 2>/dev/null | tr -d ' ')
    
    if [ "$in_recovery" = "t" ]; then
        echo "  Status: Replica (in recovery)"
        echo "krishiai_dr_in_recovery{instance=\"$name\"} 1" >> $METRICS_FILE
    elif [ "$in_recovery" = "f" ]; then
        echo "  Status: Primary (not in recovery)"
        echo "krishiai_dr_in_recovery{instance=\"$name\"} 0" >> $METRICS_FILE
    else
        echo -e "${RED}✗ Could not determine recovery status${NC}"
        return 1
    fi
    
    return 0
}

# Main health check execution
PRIMARY_HEALTHY=true
REPLICA_HEALTHY=true

echo -e "${BLUE}=== Primary Database Health ===${NC}"
echo ""

if ! check_connectivity $PRIMARY_HOST $PRIMARY_PORT "primary"; then
    PRIMARY_HEALTHY=false
fi

if ! check_query_execution $PRIMARY_HOST $PRIMARY_PORT "primary"; then
    PRIMARY_HEALTHY=false
fi

if ! check_recovery_mode $PRIMARY_HOST $PRIMARY_PORT "primary"; then
    PRIMARY_HEALTHY=false
fi

if ! check_disk_space $PRIMARY_HOST $PRIMARY_PORT "primary"; then
    PRIMARY_HEALTHY=false
fi

echo ""
echo -e "${BLUE}=== Replica Database Health ===${NC}"
echo ""

if ! check_connectivity $REPLICA_HOST $REPLICA_PORT "replica"; then
    REPLICA_HEALTHY=false
fi

if ! check_query_execution $REPLICA_HOST $REPLICA_PORT "replica"; then
    REPLICA_HEALTHY=false
fi

if ! check_recovery_mode $REPLICA_HOST $REPLICA_PORT "replica"; then
    REPLICA_HEALTHY=false
fi

if ! check_disk_space $REPLICA_HOST $REPLICA_PORT "replica"; then
    REPLICA_HEALTHY=false
fi

echo ""
echo -e "${BLUE}=== Replication Status ===${NC}"
echo ""

if ! check_replication_status; then
    REPLICA_HEALTHY=false
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Health Check Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$PRIMARY_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ Primary database: HEALTHY${NC}"
else
    echo -e "${RED}✗ Primary database: UNHEALTHY${NC}"
fi

if [ "$REPLICA_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ Replica database: HEALTHY${NC}"
else
    echo -e "${RED}✗ Replica database: UNHEALTHY${NC}"
fi

echo ""

# Export overall health status
if [ "$PRIMARY_HEALTHY" = true ] && [ "$REPLICA_HEALTHY" = true ]; then
    echo "krishiai_dr_overall_health_status 1" >> $METRICS_FILE
    echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    exit 0
else
    echo "krishiai_dr_overall_health_status 0" >> $METRICS_FILE
    echo -e "${RED}Overall Status: UNHEALTHY${NC}"
    exit 1
fi
