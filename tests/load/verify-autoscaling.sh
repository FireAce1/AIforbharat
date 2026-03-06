#!/bin/bash

# KrishiAI MVP - Auto-scaling Verification Script
# This script monitors Kubernetes pod scaling during load tests

set -e

# Configuration
NAMESPACE="krishiai"
SERVICES=("auth-service" "crop-service" "market-service" "climate-service" "govt-service")
EXPECTED_MIN_PODS=3
EXPECTED_MAX_PODS=10
MONITORING_DURATION=600  # 10 minutes (same as load test)
CHECK_INTERVAL=30        # Check every 30 seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if kubectl is available
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi
    
    # Check if HPA is configured
    for service in "${SERVICES[@]}"; do
        if ! kubectl get hpa "$service-hpa" -n "$NAMESPACE" &> /dev/null; then
            warning "HPA not found for $service"
        fi
    done
    
    success "Prerequisites check completed"
}

# Get current pod count for a service
get_pod_count() {
    local service=$1
    kubectl get pods -n "$NAMESPACE" -l app="$service" --no-headers | wc -l
}

# Get HPA status for a service
get_hpa_status() {
    local service=$1
    kubectl get hpa "$service-hpa" -n "$NAMESPACE" --no-headers 2>/dev/null || echo "N/A N/A N/A N/A"
}

# Get resource utilization
get_resource_utilization() {
    local service=$1
    kubectl top pods -n "$NAMESPACE" -l app="$service" --no-headers 2>/dev/null | \
    awk '{cpu+=$2; mem+=$3} END {print cpu"m", mem"Mi"}' || echo "N/A N/A"
}

# Monitor scaling behavior
monitor_scaling() {
    log "Starting auto-scaling monitoring for $MONITORING_DURATION seconds..."
    log "Monitoring services: ${SERVICES[*]}"
    
    # Create results file
    local results_file="autoscaling-results-$(date +%Y%m%d-%H%M%S).txt"
    
    echo "KrishiAI MVP - Auto-scaling Monitoring Results" > "$results_file"
    echo "=============================================" >> "$results_file"
    echo "Start Time: $(date)" >> "$results_file"
    echo "Duration: $MONITORING_DURATION seconds" >> "$results_file"
    echo "Check Interval: $CHECK_INTERVAL seconds" >> "$results_file"
    echo "" >> "$results_file"
    
    # Initialize tracking variables
    declare -A initial_pods
    declare -A max_pods_reached
    declare -A scaling_events
    
    # Record initial state
    log "Recording initial pod counts..."
    for service in "${SERVICES[@]}"; do
        initial_pods[$service]=$(get_pod_count "$service")
        max_pods_reached[$service]=${initial_pods[$service]}
        scaling_events[$service]=0
        log "  $service: ${initial_pods[$service]} pods"
    done
    
    # Monitor for the specified duration
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITORING_DURATION))
    local check_count=0
    
    while [ $(date +%s) -lt $end_time ]; do
        check_count=$((check_count + 1))
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        log "Check #$check_count (${elapsed}s elapsed):"
        
        # Check each service
        for service in "${SERVICES[@]}"; do
            local current_pods=$(get_pod_count "$service")
            local hpa_status=$(get_hpa_status "$service")
            local resource_usage=$(get_resource_utilization "$service")
            
            # Track maximum pods reached
            if [ "$current_pods" -gt "${max_pods_reached[$service]}" ]; then
                max_pods_reached[$service]=$current_pods
                scaling_events[$service]=$((scaling_events[$service] + 1))
                success "  $service scaled up to $current_pods pods!"
            fi
            
            # Log current status
            log "  $service: $current_pods pods | HPA: $hpa_status | Resources: $resource_usage"
            
            # Record to results file
            echo "$(date '+%H:%M:%S'),$service,$current_pods,$hpa_status,$resource_usage" >> "$results_file"
        done
        
        echo "" >> "$results_file"
        sleep $CHECK_INTERVAL
    done
    
    # Generate final report
    generate_scaling_report "$results_file" initial_pods max_pods_reached scaling_events
}

# Generate scaling report
generate_scaling_report() {
    local results_file=$1
    local -n initial_ref=$2
    local -n max_ref=$3
    local -n events_ref=$4
    
    log "Generating auto-scaling report..."
    
    echo "" >> "$results_file"
    echo "SCALING ANALYSIS SUMMARY" >> "$results_file"
    echo "========================" >> "$results_file"
    echo "End Time: $(date)" >> "$results_file"
    echo "" >> "$results_file"
    
    local overall_success=true
    
    for service in "${SERVICES[@]}"; do
        local initial=${initial_ref[$service]}
        local max_reached=${max_ref[$service]}
        local events=${events_ref[$service]}
        local scaling_factor=$((max_reached - initial))
        
        echo "Service: $service" >> "$results_file"
        echo "  Initial Pods: $initial" >> "$results_file"
        echo "  Maximum Pods: $max_reached" >> "$results_file"
        echo "  Scaling Factor: +$scaling_factor pods" >> "$results_file"
        echo "  Scaling Events: $events" >> "$results_file"
        
        # Validate scaling requirements
        if [ "$max_reached" -ge $EXPECTED_MAX_PODS ]; then
            echo "  Status: ✓ PASSED - Scaled to target capacity" >> "$results_file"
            success "$service: Scaled from $initial to $max_reached pods (target: $EXPECTED_MAX_PODS)"
        elif [ "$max_reached" -gt "$initial" ]; then
            echo "  Status: ⚠ PARTIAL - Some scaling occurred" >> "$results_file"
            warning "$service: Scaled from $initial to $max_reached pods (target: $EXPECTED_MAX_PODS)"
        else
            echo "  Status: ✗ FAILED - No scaling detected" >> "$results_file"
            error "$service: No scaling detected (stayed at $initial pods)"
            overall_success=false
        fi
        
        echo "" >> "$results_file"
    done
    
    # Overall assessment
    echo "OVERALL ASSESSMENT" >> "$results_file"
    echo "==================" >> "$results_file"
    
    if [ "$overall_success" = true ]; then
        echo "✓ AUTO-SCALING TEST PASSED" >> "$results_file"
        echo "All services demonstrated proper scaling behavior under load." >> "$results_file"
        success "Auto-scaling verification PASSED"
    else
        echo "✗ AUTO-SCALING TEST FAILED" >> "$results_file"
        echo "Some services did not scale as expected. Check HPA configuration." >> "$results_file"
        error "Auto-scaling verification FAILED"
    fi
    
    echo "" >> "$results_file"
    echo "Detailed logs available in: $results_file" >> "$results_file"
    
    log "Results saved to: $results_file"
}

# Check HPA configuration
check_hpa_configuration() {
    log "Checking HPA configuration..."
    
    for service in "${SERVICES[@]}"; do
        local hpa_name="$service-hpa"
        
        if kubectl get hpa "$hpa_name" -n "$NAMESPACE" &> /dev/null; then
            local min_replicas=$(kubectl get hpa "$hpa_name" -n "$NAMESPACE" -o jsonpath='{.spec.minReplicas}')
            local max_replicas=$(kubectl get hpa "$hpa_name" -n "$NAMESPACE" -o jsonpath='{.spec.maxReplicas}')
            local target_cpu=$(kubectl get hpa "$hpa_name" -n "$NAMESPACE" -o jsonpath='{.spec.targetCPUUtilizationPercentage}')
            
            log "  $service HPA: min=$min_replicas, max=$max_replicas, target CPU=$target_cpu%"
            
            # Validate configuration
            if [ "$min_replicas" -ne $EXPECTED_MIN_PODS ]; then
                warning "  $service: Expected min replicas $EXPECTED_MIN_PODS, got $min_replicas"
            fi
            
            if [ "$max_replicas" -lt $EXPECTED_MAX_PODS ]; then
                warning "  $service: Max replicas ($max_replicas) less than expected ($EXPECTED_MAX_PODS)"
            fi
        else
            error "  $service: HPA not configured"
        fi
    done
}

# Monitor resource metrics
monitor_resource_metrics() {
    log "Monitoring resource metrics during load test..."
    
    local metrics_file="resource-metrics-$(date +%Y%m%d-%H%M%S).csv"
    echo "timestamp,service,cpu_usage,memory_usage,pod_count" > "$metrics_file"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITORING_DURATION))
    
    while [ $(date +%s) -lt $end_time ]; do
        for service in "${SERVICES[@]}"; do
            local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
            local pod_count=$(get_pod_count "$service")
            local resource_usage=$(get_resource_utilization "$service")
            local cpu_usage=$(echo "$resource_usage" | awk '{print $1}')
            local mem_usage=$(echo "$resource_usage" | awk '{print $2}')
            
            echo "$timestamp,$service,$cpu_usage,$mem_usage,$pod_count" >> "$metrics_file"
        done
        
        sleep 10  # Collect metrics every 10 seconds
    done
    
    log "Resource metrics saved to: $metrics_file"
}

# Verify database performance under load
verify_database_performance() {
    log "Verifying database performance under load..."
    
    # Check database connections
    local db_connections=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "N/A")
    log "Active database connections: $db_connections"
    
    # Check for slow queries
    local slow_queries=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds';" 2>/dev/null || echo "N/A")
    log "Slow queries (>5s): $slow_queries"
    
    # Check database size
    local db_size=$(kubectl exec -n "$NAMESPACE" deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT pg_size_pretty(pg_database_size('krishiai_db'));" 2>/dev/null || echo "N/A")
    log "Database size: $db_size"
}

# Main execution
main() {
    echo "🚀 KrishiAI MVP - Auto-scaling Verification"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    check_hpa_configuration
    
    log "Starting monitoring in 10 seconds..."
    log "Make sure to start the load test now!"
    sleep 10
    
    # Start background monitoring
    monitor_resource_metrics &
    local metrics_pid=$!
    
    # Monitor scaling behavior
    monitor_scaling
    
    # Stop background monitoring
    kill $metrics_pid 2>/dev/null || true
    
    # Final database check
    verify_database_performance
    
    success "Auto-scaling verification completed!"
    log "Check the generated report files for detailed analysis."
}

# Handle script interruption
trap 'error "Script interrupted"; exit 1' INT TERM

# Run main function
main "$@"