#!/bin/bash

# Disaster Recovery Drill - Test Failover
# KrishiAI Platform - Quarterly DR Testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRIMARY_HOST="${PRIMARY_HOST:-postgres-primary.us-east-1.svc.cluster.local}"
REPLICA_HOST="${REPLICA_HOST:-postgres-replica.us-west-2.svc.cluster.local}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
TEST_DATABASE="${TEST_DATABASE:-dr_test_db}"

# Test report
TEST_REPORT="/var/log/postgresql/dr_test_$(date +%Y%m%d_%H%M%S).log"
mkdir -p $(dirname $TEST_REPORT)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $TEST_REPORT
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Disaster Recovery Drill${NC}"
echo -e "${BLUE}$(date)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

log "INFO: DR drill started"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${YELLOW}Test $TOTAL_TESTS: $test_name${NC}"
    log "INFO: Running test: $test_name"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        log "INFO: Test passed: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        log "ERROR: Test failed: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Phase 1: Pre-Failover Tests
echo -e "${BLUE}=== Phase 1: Pre-Failover Tests ===${NC}"
echo ""

run_test "Primary database connectivity" \
    "timeout 10 pg_isready -h $PRIMARY_HOST -U $POSTGRES_USER > /dev/null 2>&1"

run_test "Replica database connectivity" \
    "timeout 10 pg_isready -h $REPLICA_HOST -U $POSTGRES_USER > /dev/null 2>&1"

run_test "Replication status check" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -U $POSTGRES_USER -d postgres -t -c 'SELECT COUNT(*) FROM pg_stat_replication;' | grep -q '[1-9]'"

run_test "Replication lag within threshold" \
    "LAG=\$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d postgres -t -c \"SELECT COALESCE(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())), 0);\" | tr -d ' '); [ \$(echo \"\$LAG < 300\" | bc) -eq 1 ]"

# Phase 2: Create Test Data
echo ""
echo -e "${BLUE}=== Phase 2: Create Test Data ===${NC}"
echo ""

log "INFO: Creating test database and data"

# Create test database
PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -U $POSTGRES_USER -d postgres -c "
    DROP DATABASE IF EXISTS $TEST_DATABASE;
    CREATE DATABASE $TEST_DATABASE;
" > /dev/null 2>&1

# Create test table and insert data
TEST_VALUE="DR_TEST_$(date +%s)"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -U $POSTGRES_USER -d $TEST_DATABASE -c "
    CREATE TABLE dr_test (
        id SERIAL PRIMARY KEY,
        test_value VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO dr_test (test_value) VALUES ('$TEST_VALUE');
" > /dev/null 2>&1

run_test "Test data created on primary" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $PRIMARY_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c \"SELECT COUNT(*) FROM dr_test WHERE test_value='$TEST_VALUE';\" | grep -q '1'"

# Wait for replication
echo "  Waiting for replication..."
sleep 10

run_test "Test data replicated to replica" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c \"SELECT COUNT(*) FROM dr_test WHERE test_value='$TEST_VALUE';\" | grep -q '1'"

# Phase 3: Simulate Primary Failure
echo ""
echo -e "${BLUE}=== Phase 3: Simulate Primary Failure ===${NC}"
echo ""

log "INFO: Simulating primary failure"

# Record start time for RTO measurement
FAILOVER_START=$(date +%s)

# Stop primary database
echo "  Stopping primary database..."
kubectl scale deployment/postgres-primary --replicas=0 > /dev/null 2>&1

sleep 5

run_test "Primary database is down" \
    "! timeout 5 pg_isready -h $PRIMARY_HOST -U $POSTGRES_USER > /dev/null 2>&1"

# Phase 4: Execute Failover
echo ""
echo -e "${BLUE}=== Phase 4: Execute Failover ===${NC}"
echo ""

log "INFO: Executing failover"

# Promote replica
echo "  Promoting replica to primary..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d postgres -c "SELECT pg_promote();" > /dev/null 2>&1

# Wait for promotion
echo "  Waiting for promotion to complete..."
for i in {1..30}; do
    IN_RECOVERY=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d postgres -t -c "SELECT pg_is_in_recovery();" 2>/dev/null | tr -d ' ')
    if [ "$IN_RECOVERY" = "f" ]; then
        break
    fi
    sleep 2
done

# Record end time for RTO measurement
FAILOVER_END=$(date +%s)
RTO=$((FAILOVER_END - FAILOVER_START))

log "INFO: Failover completed in ${RTO}s"

run_test "Replica promoted to primary" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d postgres -t -c 'SELECT pg_is_in_recovery();' | grep -q 'f'"

run_test "RTO within 1 hour (3600s)" \
    "[ $RTO -lt 3600 ]"

# Phase 5: Post-Failover Tests
echo ""
echo -e "${BLUE}=== Phase 5: Post-Failover Tests ===${NC}"
echo ""

run_test "New primary accepts connections" \
    "timeout 10 pg_isready -h $REPLICA_HOST -U $POSTGRES_USER > /dev/null 2>&1"

run_test "Test data accessible on new primary" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c \"SELECT COUNT(*) FROM dr_test WHERE test_value='$TEST_VALUE';\" | grep -q '1'"

# Test write operations on new primary
NEW_TEST_VALUE="DR_TEST_POST_FAILOVER_$(date +%s)"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -c "
    INSERT INTO dr_test (test_value) VALUES ('$NEW_TEST_VALUE');
" > /dev/null 2>&1

run_test "Write operations work on new primary" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c \"SELECT COUNT(*) FROM dr_test WHERE test_value='$NEW_TEST_VALUE';\" | grep -q '1'"

# Phase 6: Data Integrity Verification
echo ""
echo -e "${BLUE}=== Phase 6: Data Integrity Verification ===${NC}"
echo ""

run_test "All test records present" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c 'SELECT COUNT(*) FROM dr_test;' | grep -q '2'"

run_test "No data corruption" \
    "PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d $TEST_DATABASE -t -c \"SELECT test_value FROM dr_test WHERE test_value='$TEST_VALUE';\" | grep -q '$TEST_VALUE'"

# Phase 7: Cleanup and Restore
echo ""
echo -e "${BLUE}=== Phase 7: Cleanup and Restore ===${NC}"
echo ""

log "INFO: Cleaning up test environment"

# Drop test database
PGPASSWORD=$POSTGRES_PASSWORD psql -h $REPLICA_HOST -U $POSTGRES_USER -d postgres -c "
    DROP DATABASE IF EXISTS $TEST_DATABASE;
" > /dev/null 2>&1

# Restore primary (optional - comment out for actual failover)
echo "  Restoring primary database..."
kubectl scale deployment/postgres-primary --replicas=1 > /dev/null 2>&1

sleep 30

run_test "Primary database restored" \
    "timeout 30 pg_isready -h $PRIMARY_HOST -U $POSTGRES_USER > /dev/null 2>&1"

# Demote replica back to standby (optional)
echo "  Demoting replica back to standby..."
# This would require reconfiguring replication

# Test Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DR Drill Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

log "INFO: DR drill completed"

echo -e "${BLUE}Test Results:${NC}"
echo "  Total Tests: $TOTAL_TESTS"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

echo -e "${BLUE}Performance Metrics:${NC}"
echo "  RTO (Recovery Time Objective): ${RTO}s (Target: <3600s)"
echo "  RPO (Recovery Point Objective): <5 minutes (based on replication lag)"
echo ""

echo -e "${BLUE}Test Report:${NC}"
echo "  $TEST_REPORT"
echo ""

# Export metrics
METRICS_FILE="/var/lib/postgresql/metrics/dr_test.prom"
mkdir -p $(dirname $METRICS_FILE)

cat > $METRICS_FILE <<EOF
# HELP krishiai_dr_test_last_run_timestamp Unix timestamp of last DR test
# TYPE krishiai_dr_test_last_run_timestamp gauge
krishiai_dr_test_last_run_timestamp $(date +%s)

# HELP krishiai_dr_test_status Last DR test status (1=pass, 0=fail)
# TYPE krishiai_dr_test_status gauge
krishiai_dr_test_status $([ $TESTS_FAILED -eq 0 ] && echo 1 || echo 0)

# HELP krishiai_dr_test_errors_total Total number of failed tests
# TYPE krishiai_dr_test_errors_total gauge
krishiai_dr_test_errors_total $TESTS_FAILED

# HELP krishiai_dr_test_duration_seconds RTO measured during test
# TYPE krishiai_dr_test_duration_seconds gauge
krishiai_dr_test_duration_seconds $RTO

# HELP krishiai_dr_test_tables_verified Number of tables verified
# TYPE krishiai_dr_test_tables_verified gauge
krishiai_dr_test_tables_verified 1
EOF

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    log "INFO: All tests passed"
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    log "ERROR: $TESTS_FAILED tests failed"
    exit 1
fi
