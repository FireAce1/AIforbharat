# Verify Prometheus Metrics Setup
# This script verifies that all components are properly configured

Write-Host "=== KrishiAI Prometheus Metrics Setup Verification ===" -ForegroundColor Cyan
Write-Host ""

$allChecks = $true

# Check 1: Verify prom-client in package.json files
Write-Host "1. Checking prom-client dependency in Node.js services..." -ForegroundColor Yellow

$nodeServices = @(
    "services/auth-service/package.json",
    "services/market-service/package.json",
    "services/climate-service/package.json",
    "services/govt-service/package.json",
    "services/shared/package.json"
)

foreach ($packageFile in $nodeServices) {
    if (Test-Path $packageFile) {
        $content = Get-Content $packageFile -Raw
        if ($content -match '"prom-client"') {
            Write-Host "  [OK] $packageFile" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $packageFile - prom-client not found" -ForegroundColor Red
            $allChecks = $false
        }
    } else {
        Write-Host "  [FAIL] $packageFile - file not found" -ForegroundColor Red
        $allChecks = $false
    }
}

Write-Host ""

# Check 2: Verify prometheus-client in Python requirements
Write-Host "2. Checking prometheus-client in Python service..." -ForegroundColor Yellow

$pythonReqs = "services/crop-service/requirements.txt"
if (Test-Path $pythonReqs) {
    $content = Get-Content $pythonReqs -Raw
    if ($content -match 'prometheus-client') {
        Write-Host "  [OK] $pythonReqs" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $pythonReqs - prometheus-client not found" -ForegroundColor Red
        $allChecks = $false
    }
} else {
    Write-Host "  [FAIL] $pythonReqs - file not found" -ForegroundColor Red
    $allChecks = $false
}

Write-Host ""

# Check 3: Verify monitoring module files exist
Write-Host "3. Checking monitoring module files..." -ForegroundColor Yellow

$monitoringFiles = @(
    "services/shared/monitoring/metrics.ts",
    "services/shared/monitoring/metricsMiddleware.ts",
    "services/shared/monitoring/index.ts",
    "services/shared/monitoring/README.md",
    "services/crop-service/src/monitoring/metrics.py",
    "services/crop-service/src/monitoring/middleware.py"
)

foreach ($file in $monitoringFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $file - not found" -ForegroundColor Red
        $allChecks = $false
    }
}

Write-Host ""

# Check 4: Verify /metrics endpoints in service code
Write-Host "4. Checking /metrics endpoints in services..." -ForegroundColor Yellow

$serviceFiles = @(
    "services/auth-service/src/app.ts",
    "services/market-service/src/index.ts",
    "services/climate-service/src/index.ts",
    "services/govt-service/src/index.ts",
    "services/crop-service/src/main.py"
)

foreach ($file in $serviceFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match '/metrics') {
            Write-Host "  [OK] $file" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $file - /metrics endpoint not found" -ForegroundColor Red
            $allChecks = $false
        }
    } else {
        Write-Host "  [FAIL] $file - file not found" -ForegroundColor Red
        $allChecks = $false
    }
}

Write-Host ""

# Check 5: Verify documentation files
Write-Host "5. Checking documentation..." -ForegroundColor Yellow

$docFiles = @(
    "services/TASK_14.1_IMPLEMENTATION.md",
    "TASK_14.1_SUMMARY.md",
    "services/shared/monitoring/README.md"
)

foreach ($doc in $docFiles) {
    if (Test-Path $doc) {
        Write-Host "  [OK] $doc" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $doc - not found" -ForegroundColor Red
        $allChecks = $false
    }
}

Write-Host ""
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan

if ($allChecks) {
    Write-Host "[SUCCESS] All checks passed! Prometheus metrics setup is complete." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Install dependencies: npm install in each service" -ForegroundColor Gray
    Write-Host "  2. Start services to test metrics endpoints" -ForegroundColor Gray
    Write-Host "  3. Run: .\services\test-metrics.ps1" -ForegroundColor Gray
    Write-Host "  4. Set up Prometheus server to scrape metrics" -ForegroundColor Gray
    Write-Host "  5. Create Grafana dashboards (Task 14.4)" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "[FAILED] Some checks failed. Please review the errors above." -ForegroundColor Red
    exit 1
}
