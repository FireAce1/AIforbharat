#!/bin/bash

# KrishiAI Kubernetes Deployment Verification Script
# This script verifies that all components are running correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to check pod status
check_pods() {
    print_info "Checking pod status..."
    
    local services=("auth-service" "crop-service" "market-service" "climate-service" "govt-service" "postgres" "redis")
    local all_ready=true
    
    for service in "${services[@]}"; do
        local ready=$(kubectl get pods -l app=$service -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}')
        local pod_name=$(kubectl get pods -l app=$service -o jsonpath='{.items[0].metadata.name}')
        
        if [ "$ready" == "True" ]; then
            print_success "$service: Ready ($pod_name)"
        else
            print_error "$service: Not Ready ($pod_name)"
            all_ready=false
        fi
    done
    
    echo ""
    return $([ "$all_ready" = true ] && echo 0 || echo 1)
}

# Function to check services
check_services() {
    print_info "Checking service endpoints..."
    
    local services=("auth-service:3000" "crop-service:8000" "market-service:3001" "climate-service:3002" "govt-service:3003" "postgres-service:5432" "redis-service:6379")
    local all_ready=true
    
    for service_port in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        local endpoints=$(kubectl get endpoints $service -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)
        
        if [ -n "$endpoints" ]; then
            local count=$(echo $endpoints | wc -w)
            print_success "$service: $count endpoint(s) available"
        else
            print_error "$service: No endpoints available"
            all_ready=false
        fi
    done
    
    echo ""
    return $([ "$all_ready" = true ] && echo 0 || echo 1)
}

# Function to check HPA
check_hpa() {
    print_info "Checking Horizontal Pod Autoscalers..."
    
    local hpas=("auth-service-hpa" "crop-service-hpa" "market-service-hpa" "climate-service-hpa" "govt-service-hpa")
    local all_ready=true
    
    for hpa in "${hpas[@]}"; do
        local status=$(kubectl get hpa $hpa -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}' 2>/dev/null)
        local current=$(kubectl get hpa $hpa -o jsonpath='{.status.currentReplicas}' 2>/dev/null)
        local desired=$(kubectl get hpa $hpa -o jsonpath='{.status.desiredReplicas}' 2>/dev/null)
        
        if [ "$status" == "True" ]; then
            print_success "$hpa: Active (Current: $current, Desired: $desired)"
        else
            print_warning "$hpa: Not Active or Not Found"
            all_ready=false
        fi
    done
    
    echo ""
    return $([ "$all_ready" = true ] && echo 0 || echo 1)
}

# Function to check PVCs
check_pvcs() {
    print_info "Checking Persistent Volume Claims..."
    
    local pvcs=("postgres-pvc" "redis-pvc")
    local all_bound=true
    
    for pvc in "${pvcs[@]}"; do
        local status=$(kubectl get pvc $pvc -o jsonpath='{.status.phase}' 2>/dev/null)
        local capacity=$(kubectl get pvc $pvc -o jsonpath='{.status.capacity.storage}' 2>/dev/null)
        
        if [ "$status" == "Bound" ]; then
            print_success "$pvc: Bound ($capacity)"
        else
            print_error "$pvc: Not Bound (Status: $status)"
            all_bound=false
        fi
    done
    
    echo ""
    return $([ "$all_bound" = true ] && echo 0 || echo 1)
}

# Function to test health endpoints
test_health_endpoints() {
    print_info "Testing health endpoints..."
    
    local services=("auth-service:3000" "crop-service:8000" "market-service:3001" "climate-service:3002" "govt-service:3003")
    local all_healthy=true
    
    for service_port in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        
        # Get pod name
        local pod=$(kubectl get pods -l app=$service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [ -n "$pod" ]; then
            # Test health endpoint
            local health=$(kubectl exec $pod -- wget -q -O- http://localhost:$port/health 2>/dev/null || echo "FAILED")
            
            if [ "$health" != "FAILED" ]; then
                print_success "$service: Health check passed"
            else
                print_error "$service: Health check failed"
                all_healthy=false
            fi
        else
            print_error "$service: No pod found"
            all_healthy=false
        fi
    done
    
    echo ""
    return $([ "$all_healthy" = true ] && echo 0 || echo 1)
}

# Function to check resource usage
check_resources() {
    print_info "Checking resource usage..."
    
    echo ""
    print_info "Node Resources:"
    kubectl top nodes 2>/dev/null || print_warning "Metrics server not available"
    
    echo ""
    print_info "Pod Resources:"
    kubectl top pods 2>/dev/null || print_warning "Metrics server not available"
    
    echo ""
}

# Function to show summary
show_summary() {
    echo ""
    print_info "=========================================="
    print_info "Deployment Verification Summary"
    print_info "=========================================="
    echo ""
    
    if [ $1 -eq 0 ]; then
        print_success "All checks passed! Deployment is healthy."
    else
        print_error "Some checks failed. Please review the output above."
        echo ""
        print_info "Troubleshooting commands:"
        echo "  kubectl get pods"
        echo "  kubectl describe pod <pod-name>"
        echo "  kubectl logs <pod-name>"
        echo "  kubectl get events --sort-by='.lastTimestamp'"
    fi
    
    echo ""
}

# Main verification flow
main() {
    print_info "Starting KrishiAI Deployment Verification..."
    echo ""
    
    local exit_code=0
    
    # Run all checks
    check_pods || exit_code=1
    check_services || exit_code=1
    check_hpa || exit_code=1
    check_pvcs || exit_code=1
    test_health_endpoints || exit_code=1
    check_resources
    
    # Show summary
    show_summary $exit_code
    
    exit $exit_code
}

# Run main function
main
