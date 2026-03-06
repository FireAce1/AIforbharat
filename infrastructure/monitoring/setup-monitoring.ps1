# Setup Monitoring Stack for KrishiAI Platform
# Deploys Prometheus, Grafana, and Alertmanager

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KrishiAI Monitoring Stack Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green
Write-Host ""

# Create necessary directories
Write-Host "Creating directories..." -ForegroundColor Yellow
$directories = @(
    "alerts",
    "dashboards",
    "grafana/provisioning/datasources",
    "grafana/provisioning/dashboards"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    }
}
Write-Host "✓ Directories created" -ForegroundColor Green
Write-Host ""

# Check if krishiai-network exists, create if not
Write-Host "Checking Docker network..." -ForegroundColor Yellow
$networkExists = docker network ls --filter name=krishiai-network --format "{{.Name}}" 2>$null
if (-not $networkExists) {
    Write-Host "  Creating krishiai-network..." -ForegroundColor Gray
    docker network create krishiai-network 2>$null
    Write-Host "✓ Network created" -ForegroundColor Green
} else {
    Write-Host "✓ Network already exists" -ForegroundColor Green
}
Write-Host ""

# Set environment variables
Write-Host "Setting environment variables..." -ForegroundColor Yellow
$env:SMTP_PASSWORD = "your_smtp_password_here"
$env:SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
Write-Host "✓ Environment variables set (update with real values)" -ForegroundColor Green
Write-Host ""

# Start monitoring stack
Write-Host "Starting monitoring stack..." -ForegroundColor Yellow
docker-compose -f docker-compose.monitoring.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Monitoring stack started successfully" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to start monitoring stack" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Wait for services to be ready
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host "Checking service health..." -ForegroundColor Yellow

$services = @(
    @{Name="Prometheus"; Port=9090; Path="/"},
    @{Name="Grafana"; Port=3000; Path="/api/health"},
    @{Name="Alertmanager"; Port=9093; Path="/#/status"}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($service.Port)$($service.Path)" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Host "  ✓ $($service.Name) is healthy (port $($service.Port))" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $($service.Name) is not responding (port $($service.Port))" -ForegroundColor Red
    }
}
Write-Host ""

# Display access information
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Monitoring Stack is Ready!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor White
Write-Host "  Grafana:       http://localhost:3000" -ForegroundColor White
Write-Host "    Username:    admin" -ForegroundColor Gray
Write-Host "    Password:    krishiai_admin_2024" -ForegroundColor Gray
Write-Host "  Alertmanager:  http://localhost:9093" -ForegroundColor White
Write-Host ""
Write-Host "Dashboards:" -ForegroundColor Yellow
Write-Host "  - API Performance" -ForegroundColor White
Write-Host "  - ML Model Performance" -ForegroundColor White
Write-Host "  - Business Metrics" -ForegroundColor White
Write-Host "  - Infrastructure" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open Grafana at http://localhost:3000" -ForegroundColor White
Write-Host "  2. Navigate to Dashboards > KrishiAI" -ForegroundColor White
Write-Host "  3. Update Alertmanager config with real SMTP and Slack credentials" -ForegroundColor White
Write-Host "  4. Ensure all services expose /metrics endpoints" -ForegroundColor White
Write-Host ""
Write-Host "To stop the monitoring stack:" -ForegroundColor Yellow
Write-Host "  docker-compose -f docker-compose.monitoring.yml down" -ForegroundColor White
Write-Host ""
