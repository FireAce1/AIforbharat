# KrishiAI Kubernetes Deployment Script (PowerShell)
# This script automates the deployment of KrishiAI platform to Kubernetes

$ErrorActionPreference = "Stop"

# Function to print colored output
function Print-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Print-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if kubectl is installed
function Check-Kubectl {
    try {
        $version = kubectl version --client --short 2>$null
        Print-Info "kubectl is installed: $version"
    }
    catch {
        Print-Error "kubectl is not installed. Please install kubectl first."
        exit 1
    }
}

# Function to check if cluster is accessible
function Check-Cluster {
    try {
        kubectl cluster-info 2>$null | Out-Null
        $context = kubectl config current-context
        Print-Info "Connected to cluster: $context"
    }
    catch {
        Print-Error "Cannot connect to Kubernetes cluster. Please configure kubectl."
        exit 1
    }
}

# Function to check if secrets are configured
function Check-Secrets {
    Print-Warning "Checking if secrets.yaml has been configured..."
    $secretsContent = Get-Content -Path "secrets.yaml" -Raw
    if ($secretsContent -match "CHANGE_ME_IN_PRODUCTION") {
        Print-Error "secrets.yaml contains placeholder values. Please update with production values."
        Print-Error "Edit secrets.yaml and replace all CHANGE_ME_IN_PRODUCTION values."
        exit 1
    }
    Print-Info "Secrets appear to be configured."
}

# Function to apply configuration
function Apply-Config {
    Print-Info "Applying ConfigMap..."
    kubectl apply -f configmap.yaml
    
    Print-Info "Applying Secrets..."
    kubectl apply -f secrets.yaml
}

# Function to deploy infrastructure
function Deploy-Infrastructure {
    Print-Info "Deploying PostgreSQL..."
    kubectl apply -f postgres-deployment.yaml
    
    Print-Info "Deploying Redis..."
    kubectl apply -f redis-deployment.yaml
    
    Print-Info "Waiting for PostgreSQL to be ready..."
    $pgReady = kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s 2>&1
    if ($LASTEXITCODE -ne 0) {
        Print-Error "PostgreSQL failed to start. Check logs: kubectl logs -l app=postgres"
        exit 1
    }
    
    Print-Info "Waiting for Redis to be ready..."
    $redisReady = kubectl wait --for=condition=ready pod -l app=redis --timeout=300s 2>&1
    if ($LASTEXITCODE -ne 0) {
        Print-Error "Redis failed to start. Check logs: kubectl logs -l app=redis"
        exit 1
    }
    
    Print-Info "Infrastructure deployed successfully!"
}

# Function to deploy services
function Deploy-Services {
    Print-Info "Deploying Auth Service..."
    kubectl apply -f auth-service-deployment.yaml
    
    Print-Info "Deploying Crop Service..."
    kubectl apply -f crop-service-deployment.yaml
    
    Print-Info "Deploying Market Service..."
    kubectl apply -f market-service-deployment.yaml
    
    Print-Info "Deploying Climate Service..."
    kubectl apply -f climate-service-deployment.yaml
    
    Print-Info "Deploying Government Service..."
    kubectl apply -f govt-service-deployment.yaml
    
    Print-Info "Waiting for all services to be ready..."
    $servicesReady = kubectl wait --for=condition=ready pod -l tier=backend --timeout=300s 2>&1
    if ($LASTEXITCODE -ne 0) {
        Print-Warning "Some services may not be ready. Check status: kubectl get pods"
    }
    
    Print-Info "Services deployed successfully!"
}

# Function to verify deployment
function Verify-Deployment {
    Print-Info "Verifying deployment..."
    
    Write-Host ""
    Print-Info "Pod Status:"
    kubectl get pods
    
    Write-Host ""
    Print-Info "Service Status:"
    kubectl get services
    
    Write-Host ""
    Print-Info "HPA Status:"
    kubectl get hpa
    
    Write-Host ""
    Print-Info "PVC Status:"
    kubectl get pvc
}

# Function to show next steps
function Show-NextSteps {
    Write-Host ""
    Print-Info "=========================================="
    Print-Info "Deployment Complete!"
    Print-Info "=========================================="
    Write-Host ""
    Print-Warning "Next Steps:"
    Write-Host "1. Run database migrations:"
    Write-Host "   kubectl port-forward svc/postgres-service 5432:5432"
    Write-Host "   cd services/auth-service; npm run migrate"
    Write-Host "   cd services/market-service; npm run migrate"
    Write-Host "   cd services/climate-service; npm run migrate"
    Write-Host "   cd services/govt-service; npm run migrate"
    Write-Host ""
    Write-Host "2. Test health endpoints:"
    Write-Host "   kubectl port-forward svc/auth-service 3000:3000"
    Write-Host "   curl http://localhost:3000/health"
    Write-Host ""
    Write-Host "3. View logs:"
    Write-Host "   kubectl logs -f deployment/auth-service"
    Write-Host ""
    Write-Host "4. Monitor resources:"
    Write-Host "   kubectl top pods"
    Write-Host "   kubectl top nodes"
    Write-Host ""
    Write-Host "5. Deploy ingress for external access (optional):"
    Write-Host "   kubectl apply -f tls-secret.yaml"
    Write-Host "   kubectl apply -f nginx-ingress.yaml"
    Write-Host ""
}

# Main deployment flow
function Main {
    Print-Info "Starting KrishiAI Kubernetes Deployment..."
    Write-Host ""
    
    # Pre-flight checks
    Check-Kubectl
    Check-Cluster
    Check-Secrets
    
    Write-Host ""
    $continue = Read-Host "Continue with deployment? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Print-Warning "Deployment cancelled."
        exit 0
    }
    
    # Deploy
    Apply-Config
    Deploy-Infrastructure
    Deploy-Services
    
    # Verify
    Verify-Deployment
    
    # Show next steps
    Show-NextSteps
}

# Run main function
Main
