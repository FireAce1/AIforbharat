# Test Prometheus Metrics Implementation
# This script tests that all services expose metrics correctly

Write-Host "Testing Prometheus Metrics Endpoints..." -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{Name="Auth Service"; Port=3001; Path="/metrics"},
    @{Name="Crop Service"; Port=3002; Path="/metrics"},
    @{Name="Market Service"; Port=3003; Path="/metrics"},
    @{Name="Climate Service"; Port=3004; Path="/metrics"},
    @{Name="Government Service"; Port=3005; Path="/metrics"}
)

$allPassed = $true

foreach ($service in $services) {
    Write-Host "Testing $($service.Name) on port $($service.Port)..." -ForegroundColor Yellow
    
    try {
        $url = "http://localhost:$($service.Port)$($service.Path)"
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            $content = $response.Content
            
            # Check for required metrics
            $hasHttpDuration = $content -match "http_request_duration_seconds"
            $hasHttpTotal = $content -match "http_requests_total"
            
            if ($hasHttpDuration -and $hasHttpTotal) {
                Write-Host "  ✓ Metrics endpoint working" -ForegroundColor Green
                Write-Host "  ✓ HTTP metrics present" -ForegroundColor Green
                
                # Check for ML metrics (crop service only)
                if ($service.Name -eq "Crop Service") {
                    $hasModelLatency = $content -match "model_inference_latency_seconds"
                    $hasModelAccuracy = $content -match "model_accuracy"
                    
                    if ($hasModelLatency -and $hasModelAccuracy) {
                        Write-Host "  ✓ ML model metrics present" -ForegroundColor Green
                    } else {
                        Write-Host "  ✗ ML model metrics missing" -ForegroundColor Red
                        $allPassed = $false
                    }
                }
                
                # Count total metrics
                $metricCount = ($content -split "`n" | Where-Object { $_ -match "^[a-z_]+ " }).Count
                Write-Host "  ℹ Total metrics: $metricCount" -ForegroundColor Cyan
            } else {
                Write-Host "  ✗ Required metrics missing" -ForegroundColor Red
                $allPassed = $false
            }
        } else {
            Write-Host "  ✗ Unexpected status code: $($response.StatusCode)" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host "  ✗ Service not reachable: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  ℹ Make sure the service is running on port $($service.Port)" -ForegroundColor Yellow
        $allPassed = $false
    }
    
    Write-Host ""
}

if ($allPassed) {
    Write-Host "✓ All metrics tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some metrics tests failed. See details above." -ForegroundColor Red
    Write-Host ""
    Write-Host "To start services:" -ForegroundColor Yellow
    Write-Host "  cd services/auth-service && npm run dev" -ForegroundColor Gray
    Write-Host "  cd services/crop-service && uvicorn src.main:app --reload" -ForegroundColor Gray
    Write-Host "  cd services/market-service && npm run dev" -ForegroundColor Gray
    Write-Host "  cd services/climate-service && npm run dev" -ForegroundColor Gray
    Write-Host "  cd services/govt-service && npm run dev" -ForegroundColor Gray
    exit 1
}
