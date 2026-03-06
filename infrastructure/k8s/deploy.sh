#!/bin/bash

# KrishiAI Kubernetes Deployment Script
# This script automates the deployment of KrishiAI platform to Kubernetes

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

# Function to check if kubectl is installed
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    print_info "kubectl is installed: $(kubectl version --client --short)"
}

# Function to check if cluster is accessible
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please configure kubectl."
        exit 1
    fi
    print_info "Connected to cluster: $(kubectl config current-context)"
}

# Function to check if secrets are configured
check_secrets() {
    print_warning "Checking if secrets.yaml has been configured..."
    if grep -q "CHANGE_ME_IN_PRODUCTION" secrets.yaml; then
        print_error "secrets.yaml contains placeholder values. Please update with production values."
        print_error "Edit secrets.yaml and replace all CHANGE_ME_IN_PRODUCTION values."
        exit 1
    fi
    print_info "Secrets appear to be configured."
}

# Function to apply configuration
apply_config() {
    print_info "Applying ConfigMap..."
    kubectl apply -f configmap.yaml
    
    print_info "Applying Secrets..."
    kubectl apply -f secrets.yaml
}

# Function to deploy infrastructure
deploy_infrastructure() {
    print_info "Deploying PostgreSQL..."
    kubectl apply -f postgres-deployment.yaml
    
    print_info "Deploying Redis..."
    kubectl apply -f redis-deployment.yaml
    
    print_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s || {
        print_error "PostgreSQL failed to start. Check logs: kubectl logs -l app=postgres"
        exit 1
    }
    
    print_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis --timeout=300s || {
        print_error "Redis failed to start. Check logs: kubectl logs -l app=redis"
        exit 1
    }
    
    print_info "Infrastructure deployed successfully!"
}

# Function to deploy services
deploy_services() {
    print_info "Deploying Auth Service..."
    kubectl apply -f auth-service-deployment.yaml
    
    print_info "Deploying Crop Service..."
    kubectl apply -f crop-service-deployment.yaml
    
    print_info "Deploying Market Service..."
    kubectl apply -f market-service-deployment.yaml
    
    print_info "Deploying Climate Service..."
    kubectl apply -f climate-service-deployment.yaml
    
    print_info "Deploying Government Service..."
    kubectl apply -f govt-service-deployment.yaml
    
    print_info "Waiting for all services to be ready..."
    kubectl wait --for=condition=ready pod -l tier=backend --timeout=300s || {
        print_warning "Some services may not be ready. Check status: kubectl get pods"
    }
    
    print_info "Services deployed successfully!"
}

# Function to verify deployment
verify_deployment() {
    print_info "Verifying deployment..."
    
    echo ""
    print_info "Pod Status:"
    kubectl get pods
    
    echo ""
    print_info "Service Status:"
    kubectl get services
    
    echo ""
    print_info "HPA Status:"
    kubectl get hpa
    
    echo ""
    print_info "PVC Status:"
    kubectl get pvc
}

# Function to show next steps
show_next_steps() {
    echo ""
    print_info "=========================================="
    print_info "Deployment Complete!"
    print_info "=========================================="
    echo ""
    print_warning "Next Steps:"
    echo "1. Run database migrations:"
    echo "   kubectl port-forward svc/postgres-service 5432:5432"
    echo "   cd services/auth-service && npm run migrate"
    echo "   cd services/market-service && npm run migrate"
    echo "   cd services/climate-service && npm run migrate"
    echo "   cd services/govt-service && npm run migrate"
    echo ""
    echo "2. Test health endpoints:"
    echo "   kubectl port-forward svc/auth-service 3000:3000"
    echo "   curl http://localhost:3000/health"
    echo ""
    echo "3. View logs:"
    echo "   kubectl logs -f deployment/auth-service"
    echo ""
    echo "4. Monitor resources:"
    echo "   kubectl top pods"
    echo "   kubectl top nodes"
    echo ""
    echo "5. Deploy ingress for external access (optional):"
    echo "   kubectl apply -f tls-secret.yaml"
    echo "   kubectl apply -f nginx-ingress.yaml"
    echo ""
}

# Main deployment flow
main() {
    print_info "Starting KrishiAI Kubernetes Deployment..."
    echo ""
    
    # Pre-flight checks
    check_kubectl
    check_cluster
    check_secrets
    
    echo ""
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled."
        exit 0
    fi
    
    # Deploy
    apply_config
    deploy_infrastructure
    deploy_services
    
    # Verify
    verify_deployment
    
    # Show next steps
    show_next_steps
}

# Run main function
main
