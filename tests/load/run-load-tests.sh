#!/bin/bash

# KrishiAI MVP - Comprehensive Load Testing Execution Script
# This script runs all load tests and generates comprehensive reports

set -e

# Configuration
NAMESPACE="krishiai"
BASE_URL="${BASE_URL:-http://localhost:8080}"
LOAD_TEST_DURATION=600  # 10 minutes
CONCURRENT_USERS=1000
DATABASE_RECORDS_TARGET=100000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

header() {
    echo -e "${PURPLE}$1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check k6
    if ! command -v k6 &> /dev/null; then
        error "k6 is not installed. Please install k6 first."
        echo "Installation instructions:"
        echo "  Windows: choco install k6"
        echo "  macOS: brew install k6"
        echo "  Linux: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check Node.js for database seeding
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Required for database seeding."
        exit 1
    fi
    
    success "All prerequisites are available"
}

# Verify system is ready
verify_system_ready() {
    log "Verifying system readiness..."
    
    # Check if services are running
    local services=("auth-service" "crop-service" "market-service" "climate-service" "govt-service")
    local all_ready=true
    
    for service in "${services[@]}"; do
        local ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app="$service" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        if [ "$ready_pods" -eq 0 ]; then
            error "$service is not running"
            all_ready=false
        else
            success "$service is running ($ready_pods pods)"
        fi
    done
    
    if [ "$all_ready" = false ]; then
        error "Some services are not ready. Please ensure all services are deployed and running."
        exit 1
    fi
    
    # Test basic connectivity
    log "Testing API connectivity..."
    if curl -s --max-time 10 "$BASE_URL/health" > /dev/null; then
        success "API Gateway is accessible"
    else
        error "Cannot reach API Gateway at $BASE_URL"
        exit 1
    fi
}

# Seed database with test data
seed_database() {
    log "Seeding database with $DATABASE_RECORDS_TARGET+ records..."
    
    if [ -f "seed-database.js" ]; then
        node seed-database.js
        success "Database seeding completed"
    else
        error "Database seeding script not found"
        exit 1
    fi
}

# Verify database has sufficient records
verify_database_records() {
    log "Verifying database has sufficient records..."
    
    # Check total record count (simplified check)
    local total_records=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U postgres -d krishiai_db -t -c "
        SELECT 
            (SELECT COUNT(*) FROM users) + 
            (SELECT COUNT(*) FROM farms) + 
            (SELECT COUNT(*) FROM crops) + 
            (SELECT COUNT(*) FROM market_prices) + 
            (SELECT COUNT(*) FROM weather_forecasts) + 
            (SELECT COUNT(*) FROM government_schemes)
        AS total_records;" 2>/dev/null | tr -d ' ')
    
    if [ "$total_records" -ge $DATABASE_RECORDS_TARGET ]; then
        success "Database has $total_records records (target: $DATABASE_RECORDS_TARGET)"
    else
        warning "Database has only $total_records records (target: $DATABASE_RECORDS_TARGET)"
        log "Running database seeding..."
        seed_database
    fi
}

# Run individual service load tests
run_service_tests() {
    log "Running individual service load tests..."
    
    local test_files=("auth-load-test.js" "crop-load-test.js" "market-load-test.js" "climate-load-test.js" "govt-load-test.js")
    
    for test_file in "${test_files[@]}"; do
        if [ -f "$test_file" ]; then
            local service_name=$(echo "$test_file" | cut -d'-' -f1)
            log "Running $service_name load test..."
            
            k6 run --out json="results-$service_name.json" "$test_file"
            
            if [ $? -eq 0 ]; then
                success "$service_name load test completed"
            else
                error "$service_name load test failed"
            fi
        else
            warning "$test_file not found, skipping"
        fi
    done
}

# Run comprehensive system load test
run_comprehensive_test() {
    log "Starting comprehensive system load test..."
    log "Duration: $LOAD_TEST_DURATION seconds (10 minutes)"
    log "Concurrent Users: $CONCURRENT_USERS"
    log "Target: 100+ requests/second, <1% error rate, p95 <500ms"
    
    # Start auto-scaling monitoring in background
    log "Starting auto-scaling monitoring..."
    if [ -f "verify-autoscaling.sh" ]; then
        chmod +x verify-autoscaling.sh
        ./verify-autoscaling.sh &
        local autoscaling_pid=$!
    else
        warning "Auto-scaling verification script not found"
        local autoscaling_pid=""
    fi
    
    # Run the comprehensive load test
    log "Executing comprehensive load test..."
    k6 run \
        --out json=comprehensive-load-test-results.json \
        --env BASE_URL="$BASE_URL" \
        comprehensive-load-test.js
    
    local test_exit_code=$?
    
    # Wait for auto-scaling monitoring to complete
    if [ -n "$autoscaling_pid" ]; then
        log "Waiting for auto-scaling monitoring to complete..."
        wait $autoscaling_pid
    fi
    
    return $test_exit_code
}

# Generate consolidated report
generate_consolidated_report() {
    log "Generating consolidated load test report..."
    
    local report_file="LOAD_TEST_REPORT_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << 'EOF'
# KrishiAI MVP - Load Test Report

## Executive Summary

This report presents the results of comprehensive load testing performed on the KrishiAI MVP platform.

### Test Configuration
- **Duration**: 10 minutes (2m ramp-up, 6m steady, 2m ramp-down)
- **Virtual Users**: 1,000 concurrent users
- **Target Load**: 100+ requests/second
- **Database Records**: 100K+ records
- **Auto-scaling**: 3 → 10 pods under load

### Test Scenarios
1. **New Farmer Onboarding** (15% of traffic)
2. **Daily Weather Check** (35% of traffic)
3. **Market Price Check** (25% of traffic)
4. **Disease Detection** (10% of traffic)
5. **Government Scheme Discovery** (10% of traffic)
6. **Comprehensive Farming Session** (5% of traffic)

## Performance Results

EOF

    # Add results from comprehensive test if available
    if [ -f "comprehensive-load-test-results.json" ]; then
        log "Processing comprehensive test results..."
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            local total_requests=$(jq -r '.metrics.http_reqs.values.count' comprehensive-load-test-results.json 2>/dev/null || echo "N/A")
            local request_rate=$(jq -r '.metrics.http_reqs.values.rate' comprehensive-load-test-results.json 2>/dev/null || echo "N/A")
            local error_rate=$(jq -r '.metrics.http_req_failed.values.rate' comprehensive-load-test-results.json 2>/dev/null || echo "N/A")
            local p95_latency=$(jq -r '.metrics.http_req_duration.values["p(95)"]' comprehensive-load-test-results.json 2>/dev/null || echo "N/A")
            
            cat >> "$report_file" << EOF
### Key Performance Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | ${total_requests} | - | ✓ |
| Request Rate | ${request_rate}/s | >100/s | $([ "${request_rate%.*}" -gt 100 ] 2>/dev/null && echo "✓" || echo "✗") |
| Error Rate | $(echo "$error_rate * 100" | bc 2>/dev/null || echo "$error_rate")% | <1% | $([ "$(echo "$error_rate < 0.01" | bc 2>/dev/null)" = "1" ] && echo "✓" || echo "✗") |
| p95 Latency | ${p95_latency}ms | <500ms | $([ "${p95_latency%.*}" -lt 500 ] 2>/dev/null && echo "✓" || echo "✗") |

EOF
        else
            cat >> "$report_file" << EOF
### Key Performance Metrics

*Detailed metrics available in comprehensive-load-test-results.json*

EOF
        fi
    fi
    
    # Add auto-scaling results if available
    if ls autoscaling-results-*.txt 1> /dev/null 2>&1; then
        local autoscaling_file=$(ls -t autoscaling-results-*.txt | head -n1)
        cat >> "$report_file" << EOF
## Auto-scaling Results

EOF
        tail -n 20 "$autoscaling_file" >> "$report_file"
    fi
    
    # Add recommendations
    cat >> "$report_file" << 'EOF'

## Recommendations

### Performance Optimization
- Monitor database query performance and optimize slow queries
- Implement connection pooling for database connections
- Review cache hit rates and adjust TTL settings
- Consider implementing request queuing for peak loads

### Scaling Configuration
- Verify HPA metrics and thresholds are appropriate
- Consider implementing custom metrics for auto-scaling
- Monitor resource utilization patterns for right-sizing

### Monitoring & Alerting
- Set up alerts for p95 latency > 400ms
- Monitor error rates and set alerts for > 0.5%
- Track user journey success rates
- Implement business metrics monitoring

## Files Generated

EOF
    
    # List all generated files
    echo "### Test Results" >> "$report_file"
    ls -la *.json *.txt *.html *.csv 2>/dev/null | grep -E '\.(json|txt|html|csv)$' >> "$report_file" || echo "No additional files found" >> "$report_file"
    
    success "Consolidated report generated: $report_file"
}

# Cleanup function
cleanup() {
    log "Cleaning up background processes..."
    # Kill any remaining background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main execution
main() {
    # Set up cleanup trap
    trap cleanup EXIT INT TERM
    
    header "🚀 KrishiAI MVP - Comprehensive Load Testing Suite"
    header "=================================================="
    echo ""
    
    log "Starting load test execution at $(date)"
    log "Target system: $BASE_URL"
    log "Namespace: $NAMESPACE"
    echo ""
    
    # Pre-test checks
    check_prerequisites
    verify_system_ready
    verify_database_records
    
    echo ""
    header "📊 Executing Load Tests"
    header "======================"
    
    # Run individual service tests (optional, for detailed analysis)
    if [ "${RUN_INDIVIDUAL_TESTS:-false}" = "true" ]; then
        run_service_tests
        echo ""
    fi
    
    # Run comprehensive system test
    log "Starting comprehensive system load test..."
    echo ""
    
    if run_comprehensive_test; then
        success "Comprehensive load test completed successfully!"
    else
        error "Comprehensive load test failed!"
    fi
    
    echo ""
    header "📋 Generating Reports"
    header "==================="
    
    # Generate consolidated report
    generate_consolidated_report
    
    echo ""
    header "🎯 Load Testing Complete"
    header "======================="
    
    success "All load tests completed at $(date)"
    log "Check the generated files for detailed analysis:"
    log "  - comprehensive-load-test-report.html (Visual report)"
    log "  - comprehensive-load-test-results.json (Raw data)"
    log "  - LOAD_TEST_REPORT_*.md (Consolidated report)"
    log "  - autoscaling-results-*.txt (Auto-scaling analysis)"
    
    echo ""
    log "Next steps:"
    log "  1. Review performance metrics against requirements"
    log "  2. Check auto-scaling behavior and HPA configuration"
    log "  3. Analyze any failed requests or slow responses"
    log "  4. Update monitoring dashboards with baseline metrics"
    log "  5. Document any performance optimizations needed"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "KrishiAI MVP Load Testing Suite"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --individual-tests  Run individual service tests before comprehensive test"
        echo ""
        echo "Environment Variables:"
        echo "  BASE_URL           API Gateway URL (default: http://localhost:8080)"
        echo "  NAMESPACE          Kubernetes namespace (default: krishiai)"
        echo ""
        echo "Examples:"
        echo "  $0                                    # Run comprehensive test only"
        echo "  RUN_INDIVIDUAL_TESTS=true $0         # Run all tests"
        echo "  BASE_URL=https://api.krishiai.com $0 # Test production system"
        exit 0
        ;;
    --individual-tests)
        export RUN_INDIVIDUAL_TESTS=true
        ;;
esac

# Run main function
main "$@"