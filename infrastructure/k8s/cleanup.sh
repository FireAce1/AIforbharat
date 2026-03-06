#!/bin/bash

# KrishiAI Kubernetes Cleanup Script
# This script removes all KrishiAI resources from Kubernetes

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

# Main cleanup function
main() {
    print_warning "=========================================="
    print_warning "KrishiAI Kubernetes Cleanup"
    print_warning "=========================================="
    echo ""
    print_warning "This will DELETE all KrishiAI resources including:"
    print_warning "- All backend services"
    print_warning "- PostgreSQL database (and all data)"
    print_warning "- Redis cache (and all data)"
    print_warning "- All ConfigMaps and Secrets"
    print_warning "- All Persistent Volume Claims"
    echo ""
    read -p "Are you sure you want to continue? (yes/no) " -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_info "Cleanup cancelled."
        exit 0
    fi
    
    print_info "Starting cleanup..."
    echo ""
    
    # Delete services
    print_info "Deleting backend services..."
    kubectl delete -f auth-service-deployment.yaml --ignore-not-found=true
    kubectl delete -f crop-service-deployment.yaml --ignore-not-found=true
    kubectl delete -f market-service-deployment.yaml --ignore-not-found=true
    kubectl delete -f climate-service-deployment.yaml --ignore-not-found=true
    kubectl delete -f govt-service-deployment.yaml --ignore-not-found=true
    
    # Delete infrastructure
    print_info "Deleting infrastructure..."
    kubectl delete -f postgres-deployment.yaml --ignore-not-found=true
    kubectl delete -f redis-deployment.yaml --ignore-not-found=true
    
    # Delete configuration
    print_info "Deleting configuration..."
    kubectl delete -f configmap.yaml --ignore-not-found=true
    kubectl delete -f secrets.yaml --ignore-not-found=true
    
    # Delete ingress (if exists)
    print_info "Deleting ingress..."
    kubectl delete -f nginx-ingress.yaml --ignore-not-found=true 2>/dev/null || true
    kubectl delete -f tls-secret.yaml --ignore-not-found=true 2>/dev/null || true
    
    # Wait for pods to terminate
    print_info "Waiting for pods to terminate..."
    kubectl wait --for=delete pod -l tier=backend --timeout=120s 2>/dev/null || true
    kubectl wait --for=delete pod -l app=postgres --timeout=120s 2>/dev/null || true
    kubectl wait --for=delete pod -l app=redis --timeout=120s 2>/dev/null || true
    
    echo ""
    print_info "=========================================="
    print_info "Cleanup Complete!"
    print_info "=========================================="
    echo ""
    print_info "Remaining resources:"
    kubectl get all
    echo ""
    print_warning "Note: Persistent Volume Claims may still exist."
    print_warning "To delete PVCs and lose all data permanently:"
    print_warning "  kubectl delete pvc postgres-pvc"
    print_warning "  kubectl delete pvc redis-pvc"
}

# Run main function
main
