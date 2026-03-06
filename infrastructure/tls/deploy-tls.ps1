# PowerShell Script for TLS Deployment on Windows
# Deploys NGINX with TLS configuration for KrishiAI platform

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    
    [Parameter(Mandatory=$false)]
    [string]$CertPath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$KeyPath = ""
)

Write-Host "=========================================="
Write-Host "KrishiAI TLS Deployment Script"
Write-Host "Environment: $Environment"
Write-Host "=========================================="
Write-Host ""

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
} catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    Write-Host "Start Docker Desktop and try again"
    exit 1
}

Write-Host "✓ Docker is installed and running" -ForegroundColor Green
Write-Host ""

# Create certificate directories
$certDir = ".\certs\$Environment"
if (-not (Test-Path $certDir)) {
    Write-Host "Creating certificate directory: $certDir"
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

# Handle certificate setup
if ($Environment -eq "staging") {
    Write-Host "Staging Environment: Using self-signed certificates" -ForegroundColor Yellow
    Write-Host ""
    
    # Generate self-signed certificate for staging
    $certFile = "$certDir\fullchain.pem"
    $keyFile = "$certDir\privkey.pem"
    
    if (-not (Test-Path $certFile)) {
        Write-Host "Generating self-signed certificate..."
        
        # Use OpenSSL if available, otherwise use PowerShell
        if (Get-Command openssl -ErrorAction SilentlyContinue) {
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
                -keyout $keyFile `
                -out $certFile `
                -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=KrishiAI/CN=api.krishiai.local"
            
            Copy-Item $certFile "$certDir\chain.pem"
        } else {
            Write-Host "Warning: OpenSSL not found. Please install OpenSSL or provide certificates manually" -ForegroundColor Yellow
            Write-Host "Download from: https://slproweb.com/products/Win32OpenSSL.html"
            exit 1
        }
        
        Write-Host "✓ Self-signed certificate generated" -ForegroundColor Green
    } else {
        Write-Host "✓ Certificate already exists" -ForegroundColor Green
    }
} else {
    Write-Host "Production Environment: Using provided certificates" -ForegroundColor Yellow
    Write-Host ""
    
    if ($CertPath -eq "" -or $KeyPath -eq "") {
        Write-Host "Error: Certificate and key paths required for production" -ForegroundColor Red
        Write-Host "Usage: .\deploy-tls.ps1 -Environment production -CertPath <cert> -KeyPath <key>"
        exit 1
    }
    
    if (-not (Test-Path $CertPath)) {
        Write-Host "Error: Certificate file not found: $CertPath" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Path $KeyPath)) {
        Write-Host "Error: Key file not found: $KeyPath" -ForegroundColor Red
        exit 1
    }
    
    # Copy certificates to deployment directory
    Copy-Item $CertPath "$certDir\fullchain.pem"
    Copy-Item $KeyPath "$certDir\privkey.pem"
    Copy-Item $CertPath "$certDir\chain.pem"
    
    Write-Host "✓ Certificates copied to deployment directory" -ForegroundColor Green
}

Write-Host ""

# Generate Diffie-Hellman parameters if not exists
$dhparamFile = ".\dhparam.pem"
if (-not (Test-Path $dhparamFile)) {
    Write-Host "Generating Diffie-Hellman parameters (this may take a while)..."
    
    if (Get-Command openssl -ErrorAction SilentlyContinue) {
        openssl dhparam -out $dhparamFile 2048
        Write-Host "✓ Diffie-Hellman parameters generated" -ForegroundColor Green
    } else {
        Write-Host "Warning: OpenSSL not found. Skipping DH parameter generation" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Diffie-Hellman parameters already exist" -ForegroundColor Green
}

Write-Host ""

# Build NGINX Docker image
Write-Host "Building NGINX Docker image..."
Set-Location ..\docker
docker build -f Dockerfile.nginx -t krishiai/nginx:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ NGINX image built successfully" -ForegroundColor Green
} else {
    Write-Host "Error: Failed to build NGINX image" -ForegroundColor Red
    exit 1
}

Set-Location ..\tls
Write-Host ""

# Start services with Docker Compose
Write-Host "Starting services with TLS..."
Set-Location ..\..

docker-compose -f docker-compose.yml -f infrastructure\docker\docker-compose.tls.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Services started successfully" -ForegroundColor Green
} else {
    Write-Host "Error: Failed to start services" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================="
Write-Host "TLS Deployment Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Services running:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Test HTTPS connection: curl -k https://localhost"
Write-Host "2. View NGINX logs: docker logs krishiai-nginx"
Write-Host "3. Update mobile app certificate pins"
Write-Host "4. Test mobile app connectivity"
Write-Host ""
Write-Host "To stop services:"
Write-Host "  docker-compose -f docker-compose.yml -f infrastructure\docker\docker-compose.tls.yml down"
Write-Host ""
