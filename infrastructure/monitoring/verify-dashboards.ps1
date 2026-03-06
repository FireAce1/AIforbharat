# Verify Grafana Dashboards Setup
# This script verifies that all monitoring dashboards and alerts are properly configured

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KrishiAI Monitoring Dashboard Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# Function to check if a file exists
function Test-FileExists {
    param($Path, $Description)
    
    if (Test-Path $Path) {
        Write-Host "[OK] $Description exists" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[ERROR] $Description not found: $Path" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

# Function to check JSON validity
function Test-JsonValid {
    param($Path, $Description)
    
    try {
        $content = Get-Content $Path -Raw
        $json = $content | ConvertFrom-Json
        Write-Host "[OK] $Description is valid JSON" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERROR] $Description has invalid JSON: $_" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

# Function to check YAML validity
function Test-YamlValid {
    param($Path, $Description)
    
    try {
        $content = Get-Content $Path -Raw
        # Basic YAML validation (check for common syntax errors)
        if ($content -match "^\s*-\s*$" -or $content -match ":\s*$") {
            Write-Host "[WARNING] $Description may have YAML syntax issues" -ForegroundColor Yellow
            $script:WarningCount++
        } else {
            Write-Host "[OK] $Description appears valid" -ForegroundColor Green
        }
        return $true
    } catch {
        Write-Host "[ERROR] $Description has issues: $_" -ForegroundColor Red
        $script:ErrorCount++
        return $false
    }
}

# Function to check Docker container status
function Test-ContainerRunning {
    param($ContainerName, $Description)
    
    try {
        $container = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
        if ($container -eq $ContainerName) {
            Write-Host "[OK] $Description is running" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[WARNING] $Description is not running" -ForegroundColor Yellow
            $script:WarningCount++
            return $false
        }
    } catch {
        Write-Host "[WARNING] Could not check $Description status (Docker may not be running)" -ForegroundColor Yellow
        $script:WarningCount++
        return $false
    }
}

# Function to check HTTP endpoint
function Test-HttpEndpoint {
    param($Url, $Description)
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing 2>$null
        if ($response.StatusCode -eq 200) {
            Write-Host "[OK] $Description is accessible" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[WARNING] $Description returned status $($response.StatusCode)" -ForegroundColor Yellow
            $script:WarningCount++
            return $false
        }
    } catch {
        Write-Host "[WARNING] $Description is not accessible (service may not be running)" -ForegroundColor Yellow
        $script:WarningCount++
        return $false
    }
}

Write-Host "1. Checking Dashboard Files..." -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$dashboards = @(
    @{Path="dashboards/api-performance.json"; Name="API Performance Dashboard"},
    @{Path="dashboards/ml-performance.json"; Name="ML Performance Dashboard"},
    @{Path="dashboards/business-metrics.json"; Name="Business Metrics Dashboard"},
    @{Path="dashboards/infrastructure.json"; Name="Infrastructure Dashboard"}
)

foreach ($dashboard in $dashboards) {
    if (Test-FileExists $dashboard.Path $dashboard.Name) {
        Test-JsonValid $dashboard.Path $dashboard.Name
    }
}

Write-Host ""
Write-Host "2. Checking Alert Rule Files..." -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$alerts = @(
    @{Path="alerts/api-performance.yml"; Name="API Performance Alerts"},
    @{Path="alerts/ml-performance.yml"; Name="ML Performance Alerts"},
    @{Path="alerts/business-metrics.yml"; Name="Business Metrics Alerts"},
    @{Path="alerts/infrastructure.yml"; Name="Infrastructure Alerts"}
)

foreach ($alert in $alerts) {
    if (Test-FileExists $alert.Path $alert.Name) {
        Test-YamlValid $alert.Path $alert.Name
    }
}

Write-Host ""
Write-Host "3. Checking Configuration Files..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

Test-FileExists "prometheus.yml" "Prometheus Configuration"
Test-FileExists "alertmanager.yml" "Alertmanager Configuration"
Test-FileExists "docker-compose.monitoring.yml" "Docker Compose Configuration"
Test-FileExists "grafana/provisioning/datasources/prometheus.yml" "Grafana Datasource Provisioning"
Test-FileExists "grafana/provisioning/dashboards/default.yml" "Grafana Dashboard Provisioning"

Write-Host ""
Write-Host "4. Checking Docker Containers..." -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

$containers = @(
    @{Name="krishiai-prometheus"; Description="Prometheus"},
    @{Name="krishiai-grafana"; Description="Grafana"},
    @{Name="krishiai-alertmanager"; Description="Alertmanager"},
    @{Name="krishiai-node-exporter"; Description="Node Exporter"},
    @{Name="krishiai-postgres-exporter"; Description="PostgreSQL Exporter"},
    @{Name="krishiai-redis-exporter"; Description="Redis Exporter"}
)

foreach ($container in $containers) {
    Test-ContainerRunning $container.Name $container.Description
}

Write-Host ""
Write-Host "5. Checking Service Endpoints..." -ForegroundColor Cyan
Write-Host "---------------------------------" -ForegroundColor Cyan

$endpoints = @(
    @{Url="http://localhost:9090/-/healthy"; Description="Prometheus Health"},
    @{Url="http://localhost:3000/api/health"; Description="Grafana Health"},
    @{Url="http://localhost:9093/-/healthy"; Description="Alertmanager Health"}
)

foreach ($endpoint in $endpoints) {
    Test-HttpEndpoint $endpoint.Url $endpoint.Description
}

Write-Host ""
Write-Host "6. Validating Dashboard Content..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

# Check API Performance Dashboard
$apiDashboard = Get-Content "dashboards/api-performance.json" -Raw | ConvertFrom-Json
$apiPanels = $apiDashboard.dashboard.panels.Count
if ($apiPanels -ge 7) {
    Write-Host "[OK] API Performance Dashboard has $apiPanels panels (expected: 7+)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] API Performance Dashboard has only $apiPanels panels (expected: 7+)" -ForegroundColor Red
    $ErrorCount++
}

# Check ML Performance Dashboard
$mlDashboard = Get-Content "dashboards/ml-performance.json" -Raw | ConvertFrom-Json
$mlPanels = $mlDashboard.dashboard.panels.Count
if ($mlPanels -ge 9) {
    Write-Host "[OK] ML Performance Dashboard has $mlPanels panels (expected: 9+)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] ML Performance Dashboard has only $mlPanels panels (expected: 9+)" -ForegroundColor Red
    $ErrorCount++
}

# Check Business Metrics Dashboard
$businessDashboard = Get-Content "dashboards/business-metrics.json" -Raw | ConvertFrom-Json
$businessPanels = $businessDashboard.dashboard.panels.Count
if ($businessPanels -ge 11) {
    Write-Host "[OK] Business Metrics Dashboard has $businessPanels panels (expected: 11+)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Business Metrics Dashboard has only $businessPanels panels (expected: 11+)" -ForegroundColor Red
    $ErrorCount++
}

# Check Infrastructure Dashboard
$infraDashboard = Get-Content "dashboards/infrastructure.json" -Raw | ConvertFrom-Json
$infraPanels = $infraDashboard.dashboard.panels.Count
if ($infraPanels -ge 6) {
    Write-Host "[OK] Infrastructure Dashboard has $infraPanels panels (expected: 6+)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Infrastructure Dashboard has only $infraPanels panels (expected: 6+)" -ForegroundColor Red
    $ErrorCount++
}

Write-Host ""
Write-Host "7. Validating Alert Rules..." -ForegroundColor Cyan
Write-Host "-----------------------------" -ForegroundColor Cyan

# Check for critical alerts
$apiAlerts = Get-Content "alerts/api-performance.yml" -Raw
if ($apiAlerts -match "HighAPILatency" -and $apiAlerts -match "HighErrorRate" -and $apiAlerts -match "ServiceDown") {
    Write-Host "[OK] API Performance alerts include required rules" -ForegroundColor Green
} else {
    Write-Host "[ERROR] API Performance alerts missing required rules" -ForegroundColor Red
    $ErrorCount++
}

$mlAlerts = Get-Content "alerts/ml-performance.yml" -Raw
if ($mlAlerts -match "HighMLInferenceLatency" -and $mlAlerts -match "LowModelAccuracy") {
    Write-Host "[OK] ML Performance alerts include required rules" -ForegroundColor Green
} else {
    Write-Host "[ERROR] ML Performance alerts missing required rules" -ForegroundColor Red
    $ErrorCount++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "[SUCCESS] All checks passed! Monitoring setup is complete." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Start monitoring stack: docker-compose -f docker-compose.monitoring.yml up -d" -ForegroundColor White
    Write-Host "2. Access Grafana: http://localhost:3000 (admin/krishiai_admin_2024)" -ForegroundColor White
    Write-Host "3. Access Prometheus: http://localhost:9090" -ForegroundColor White
    Write-Host "4. Access Alertmanager: http://localhost:9093" -ForegroundColor White
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "[WARNING] Verification completed with $WarningCount warnings" -ForegroundColor Yellow
    Write-Host "Some services may not be running. Start them with:" -ForegroundColor Yellow
    Write-Host "docker-compose -f docker-compose.monitoring.yml up -d" -ForegroundColor White
    exit 0
} else {
    Write-Host "[FAILED] Verification failed with $ErrorCount errors and $WarningCount warnings" -ForegroundColor Red
    Write-Host "Please review the errors above and fix the issues." -ForegroundColor Red
    exit 1
}
