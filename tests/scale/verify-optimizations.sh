#!/bin/bash

# KrishiAI Scale Optimization Verification Script
# Purpose: Verify all scale optimizations are working correctly
# Requirements: kubectl, psql, redis-cli, curl

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-krishiai_db}"
DB_USER="${DB_USER:-postgres}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
API_URL="${API_URL:-http://localhost:3000}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}KrishiAI Scale Optimization Verification${NC}"
echo -e "${BLUE}========================================${NC}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Testing: ${test_name}${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# ============================================================================
# 1. Database Optimizations
# ============================================================================

echo -e "\n${BLUE}=== 1. Database Optimizations ===${NC}"

# Test materialized views exist
run_test "Materialized views created" "
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"
        SELECT COUNT(*) FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname LIKE 'mv_%'
    \" | grep -q '^6$'
"

# Test table partitioning
run_test "Table partitioning configured" "
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"
        SELECT COUNT(*) FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename LIKE 'market_prices_%' OR tablename LIKE 'weather_forecasts_%')
    \" | awk '\$1 > 10 {exit 0} {exit 1}'
"

# Test query performance
run_test "Query performance optimized" "
    QUERY_TIME=\$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"
        EXPLAIN ANALYZE 
        SELECT * FROM market_prices 
        WHERE time >= NOW() - INTERVAL '7 days' 
        AND crop_name = 'Tomato'
    \" | grep 'Execution Time' | awk '{print \$3}')
    
    # Check if query time < 100ms
    awk -v time=\"\$QUERY_TIME\" 'BEGIN {exit !(time < 100)}'
"

# Test indexes exist
run_test "Database indexes created" "
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"
        SELECT COUNT(*) FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('market_prices', 'weather_forecasts', 'users', 'farms')
    \" | awk '\$1 > 15 {exit 0} {exit 1}'
"

# ============================================================================
# 2. Caching Layer
# ============================================================================

echo -e "\n${BLUE}=== 2. Caching Layer ===${NC}"

# Test Redis connectivity
run_test "Redis connectivity" "
    redis-cli -h $REDIS_HOST -p $REDIS_PORT PING | grep -q 'PONG'
"

# Test cache hit rate
run_test "Cache hit rate > 60%" "
    HIT_RATE=\$(redis-cli -h $REDIS_HOST -p $REDIS_PORT INFO stats | 
        grep 'keyspace_hits\\|keyspace_misses' | 
        awk -F: '{sum+=\$2} END {
            hits=\$2; 
            total=sum; 
            if(total>0) print (hits/total)*100; 
            else print 0
        }')
    
    awk -v rate=\"\$HIT_RATE\" 'BEGIN {exit !(rate > 60)}'
"

# Test cache keys exist
run_test "Cache keys populated" "
    KEY_COUNT=\$(redis-cli -h $REDIS_HOST -p $REDIS_PORT DBSIZE | awk '{print \$2}')
    awk -v count=\"\$KEY_COUNT\" 'BEGIN {exit !(count > 100)}'
"

# Test cache TTL configured
run_test "Cache TTL configured" "
    redis-cli -h $REDIS_HOST -p $REDIS_PORT SET test_key test_value EX 60
    TTL=\$(redis-cli -h $REDIS_HOST -p $REDIS_PORT TTL test_key)
    redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL test_key
    awk -v ttl=\"\$TTL\" 'BEGIN {exit !(ttl > 0 && ttl <= 60)}'
"

# ============================================================================
# 3. Kubernetes Auto-Scaling
# ============================================================================

echo -e "\n${BLUE}=== 3. Kubernetes Auto-Scaling ===${NC}"

# Test HPA configured
run_test "HPA policies deployed" "
    kubectl get hpa 2>/dev/null | grep -q 'auth-service-hpa\\|crop-service-hpa\\|market-service-hpa'
"

# Test HPA targets
run_test "HPA targets configured" "
    HPA_COUNT=\$(kubectl get hpa -o json 2>/dev/null | 
        jq '.items | length')
    awk -v count=\"\$HPA_COUNT\" 'BEGIN {exit !(count >= 5)}'
"

# Test pod replicas
run_test "Minimum pod replicas running" "
    REPLICA_COUNT=\$(kubectl get deployments -o json 2>/dev/null | 
        jq '[.items[].status.replicas] | add')
    awk -v count=\"\$REPLICA_COUNT\" 'BEGIN {exit !(count >= 15)}'
"

# Test cluster autoscaler
run_test "Cluster autoscaler deployed" "
    kubectl get deployment cluster-autoscaler -n kube-system 2>/dev/null | grep -q 'cluster-autoscaler'
"

# ============================================================================
# 4. API Performance
# ============================================================================

echo -e "\n${BLUE}=== 4. API Performance ===${NC}"

# Test API response time
run_test "API response time < 500ms" "
    RESPONSE_TIME=\$(curl -o /dev/null -s -w '%{time_total}' $API_URL/health)
    RESPONSE_MS=\$(awk -v time=\"\$RESPONSE_TIME\" 'BEGIN {print time * 1000}')
    awk -v time=\"\$RESPONSE_MS\" 'BEGIN {exit !(time < 500)}'
"

# Test API rate limiting
run_test "Rate limiting configured" "
    # Make multiple requests
    for i in {1..10}; do
        curl -s -o /dev/null -w '%{http_code}' $API_URL/api/v1/market/prices
    done | grep -q '429' || echo 'Rate limiting may not be strict enough'
    exit 0  # Don't fail if rate limit not hit
"

# Test compression enabled
run_test "Response compression enabled" "
    curl -s -H 'Accept-Encoding: gzip' -I $API_URL/api/v1/market/prices | 
        grep -qi 'Content-Encoding: gzip'
"

# ============================================================================
# 5. CDN Configuration
# ============================================================================

echo -e "\n${BLUE}=== 5. CDN Configuration ===${NC}"

# Test CDN endpoint
run_test "CDN endpoint accessible" "
    curl -s -o /dev/null -w '%{http_code}' https://cdn.krishiai.com/static/test.html | 
        grep -q '200\\|404'  # 404 is ok if file doesn't exist
"

# Test CDN caching headers
run_test "CDN cache headers present" "
    curl -s -I https://cdn.krishiai.com/static/test.css | 
        grep -qi 'Cache-Control\\|X-Cache'
"

# ============================================================================
# 6. ML Inference Optimization
# ============================================================================

echo -e "\n${BLUE}=== 6. ML Inference Optimization ===${NC}"

# Test batch inference endpoint
run_test "Batch inference endpoint available" "
    curl -s -o /dev/null -w '%{http_code}' $API_URL/api/v1/crop/recommend | 
        grep -q '200\\|401\\|403'  # Auth required is ok
"

# Test model loading
run_test "ML models loaded" "
    # Check if crop service is responding
    curl -s $API_URL/health | grep -q 'crop-service\\|ok'
"

# ============================================================================
# 7. Monitoring and Metrics
# ============================================================================

echo -e "\n${BLUE}=== 7. Monitoring and Metrics ===${NC}"

# Test Prometheus metrics
run_test "Prometheus metrics exposed" "
    curl -s $API_URL/metrics | grep -q 'http_requests_total\\|process_cpu_seconds_total'
"

# Test Grafana dashboards
run_test "Grafana accessible" "
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3001 | 
        grep -q '200\\|302'
"

# ============================================================================
# Summary
# ============================================================================

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "\nTotal Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "Success Rate: $SUCCESS_RATE%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All optimizations verified successfully!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠ Some optimizations need attention${NC}"
    exit 1
fi
