# KrishiAI MVP - Auto-scaling Verification Script (PowerShell)
# This script monitors Kubernetes pod scaling during load tests

param(
    [string]$Namespace = "krishiai",
    [int]$MonitoringDuration = 600,  # 10 minutes
    [int]$CheckInterval = 30,        # 30 seconds
    [int]$ExpectedMinPods = 3,
    [int]$ExpectedMaxPods = 10
)

# Configuration
$Services = @("auth-service", "crop-service", "market-service", "climate-service", "govt-service")

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        default { "Cyan" }
    }
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor $color
}

function Write-Success {
    param([string]$Message)
    Write-Log "✓ $Message" -Level "SUCCESS"
}

function Write-Warning {
    param([string]$Message)
    Write-Log "⚠ $Message" -Level "WARNING"
}

function Write-Error {
    param([string]$Message)
    Write-Log "✗ $Message" -Level "ERROR"
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check kubectl
    try {
        $null = kubectl version --client --short 2>$null
        Write-Success "kubectl is available"
    }
    catch {
        Write-Error "kubectl is not installed or not in PATH"
        exit 1
    }
    
    # Check namespace
    try {
        $null = kubectl get namespace $Namespace 2>$null
        Write-Success "Namespace '$Namespace' exists"
    }
    catch {
        Write-Error "Namespace '$Namespace' does not exist"
        exit 1
    }
    
    # Check HPA configuration
    foreach ($service in $Services) {
        try {
            $null = kubectl get hpa "$service-hpa" -n $Namespace 2>$null
            Write-Success "HPA configured for $service"
        }
        catch {
            Write-Warning "HPA not found for $service"
        }
    }
}

# Get pod count for a service
function Get-PodCount {
    param([string]$ServiceName)
    
    try {
        $pods = kubectl get pods -n $Namespace -l app=$ServiceName --no-headers 2>$null
        if ($pods) {
            return ($pods | Measure-Object).Count
        }
        return 0
    }
    catch {
        return 0
    }
}

# Get HPA status
function Get-HPAStatus {
    param([string]$ServiceName)
    
    try {
        $hpa = kubectl get hpa "$ServiceName-hpa" -n $Namespace --no-headers 2>$null
        if ($hpa) {
            return $hpa
        }
        return "N/A"
    }
    catch {
        return "N/A"
    }
}

# Get resource utilization
function Get-ResourceUtilization {
    param([string]$ServiceName)
    
    try {
        $resources = kubectl top pods -n $Namespace -l app=$ServiceName --no-headers 2>$null
        if ($resources) {
            $totalCpu = 0
            $totalMem = 0
            
            foreach ($line in $resources) {
                $parts = $line -split '\s+'
                if ($parts.Length -ge 3) {
                    $cpu = $parts[1] -replace 'm', ''
                    $mem = $parts[2] -replace 'Mi', ''
                    $totalCpu += [int]$cpu
                    $totalMem += [int]$mem
                }
            }
            
            return "${totalCpu}m ${totalMem}Mi"
        }
        return "N/A N/A"
    }
    catch {
        return "N/A N/A"
    }
}

# Monitor scaling behavior
function Start-ScalingMonitor {
    Write-Log "Starting auto-scaling monitoring for $MonitoringDuration seconds..."
    Write-Log "Monitoring services: $($Services -join ', ')"
    
    # Create results file
    $resultsFile = "autoscaling-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    
    @"
KrishiAI MVP - Auto-scaling Monitoring Results
=============================================
Start Time: $(Get-Date)
Duration: $MonitoringDuration seconds
Check Interval: $CheckInterval seconds

"@ | Out-File -FilePath $resultsFile -Encoding UTF8
    
    # Initialize tracking
    $initialPods = @{}
    $maxPodsReached = @{}
    $scalingEvents = @{}
    
    # Record initial state
    Write-Log "Recording initial pod counts..."
    foreach ($service in $Services) {
        $initialCount = Get-PodCount -ServiceName $service
        $initialPods[$service] = $initialCount
        $maxPodsReached[$service] = $initialCount
        $scalingEvents[$service] = 0
        Write-Log "  $service`: $initialCount pods"
    }
    
    # Monitor for specified duration
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($MonitoringDuration)
    $checkCount = 0
    
    while ((Get-Date) -lt $endTime) {
        $checkCount++
        $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
        
        Write-Log "Check #$checkCount (${elapsed}s elapsed):"
        
        foreach ($service in $Services) {
            $currentPods = Get-PodCount -ServiceName $service
            $hpaStatus = Get-HPAStatus -ServiceName $service
            $resourceUsage = Get-ResourceUtilization -ServiceName $service
            
            # Track maximum pods
            if ($currentPods -gt $maxPodsReached[$service]) {
                $maxPodsReached[$service] = $currentPods
                $scalingEvents[$service]++
                Write-Success "  $service scaled up to $currentPods pods!"
            }
            
            Write-Log "  $service`: $currentPods pods | HPA: $hpaStatus | Resources: $resourceUsage"
            
            # Record to file
            "$(Get-Date -Format 'HH:mm:ss'),$service,$currentPods,$hpaStatus,$resourceUsage" | 
                Out-File -FilePath $resultsFile -Append -Encoding UTF8
        }
        
        "" | Out-File -FilePath $resultsFile -Append -Encoding UTF8
        Start-Sleep -Seconds $CheckInterval
    }
    
    # Generate final report
    New-ScalingReport -ResultsFile $resultsFile -InitialPods $initialPods -MaxPods $maxPodsReached -Events $scalingEvents
}

# Generate scaling report
function New-ScalingReport {
    param(
        [string]$ResultsFile,
        [hashtable]$InitialPods,
        [hashtable]$MaxPods,
        [hashtable]$Events
    )
    
    Write-Log "Generating auto-scaling report..."
    
    @"

SCALING ANALYSIS SUMMARY
========================
End Time: $(Get-Date)

"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
    
    $overallSuccess = $true
    
    foreach ($service in $Services) {
        $initial = $InitialPods[$service]
        $maxReached = $MaxPods[$service]
        $eventCount = $Events[$service]
        $scalingFactor = $maxReached - $initial
        
        @"
Service: $service
  Initial Pods: $initial
  Maximum Pods: $maxReached
  Scaling Factor: +$scalingFactor pods
  Scaling Events: $eventCount
"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
        
        # Validate scaling requirements
        if ($maxReached -ge $ExpectedMaxPods) {
            "  Status: ✓ PASSED - Scaled to target capacity" | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
            Write-Success "$service`: Scaled from $initial to $maxReached pods (target: $ExpectedMaxPods)"
        }
        elseif ($maxReached -gt $initial) {
            "  Status: ⚠ PARTIAL - Some scaling occurred" | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
            Write-Warning "$service`: Scaled from $initial to $maxReached pods (target: $ExpectedMaxPods)"
        }
        else {
            "  Status: ✗ FAILED - No scaling detected" | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
            Write-Error "$service`: No scaling detected (stayed at $initial pods)"
            $overallSuccess = $false
        }
        
        "" | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
    }
    
    # Overall assessment
    @"
OVERALL ASSESSMENT
==================
"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
    
    if ($overallSuccess) {
        @"
✓ AUTO-SCALING TEST PASSED
All services demonstrated proper scaling behavior under load.
"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
        Write-Success "Auto-scaling verification PASSED"
    }
    else {
        @"
✗ AUTO-SCALING TEST FAILED
Some services did not scale as expected. Check HPA configuration.
"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
        Write-Error "Auto-scaling verification FAILED"
    }
    
    @"

Detailed logs available in: $ResultsFile
"@ | Out-File -FilePath $ResultsFile -Append -Encoding UTF8
    
    Write-Log "Results saved to: $ResultsFile"
}

# Check HPA configuration
function Test-HPAConfiguration {
    Write-Log "Checking HPA configuration..."
    
    foreach ($service in $Services) {
        $hpaName = "$service-hpa"
        
        try {
            $minReplicas = kubectl get hpa $hpaName -n $Namespace -o jsonpath='{.spec.minReplicas}' 2>$null
            $maxReplicas = kubectl get hpa $hpaName -n $Namespace -o jsonpath='{.spec.maxReplicas}' 2>$null
            $targetCpu = kubectl get hpa $hpaName -n $Namespace -o jsonpath='{.spec.targetCPUUtilizationPercentage}' 2>$null
            
            Write-Log "  $service HPA: min=$minReplicas, max=$maxReplicas, target CPU=$targetCpu%"
            
            if ([int]$minReplicas -ne $ExpectedMinPods) {
                Write-Warning "  $service`: Expected min replicas $ExpectedMinPods, got $minReplicas"
            }
            
            if ([int]$maxReplicas -lt $ExpectedMaxPods) {
                Write-Warning "  $service`: Max replicas ($maxReplicas) less than expected ($ExpectedMaxPods)"
            }
        }
        catch {
            Write-Error "  $service`: HPA not configured"
        }
    }
}

# Monitor resource metrics
function Start-ResourceMonitoring {
    Write-Log "Starting resource metrics monitoring..."
    
    $metricsFile = "resource-metrics-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
    "timestamp,service,cpu_usage,memory_usage,pod_count" | Out-File -FilePath $metricsFile -Encoding UTF8
    
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($MonitoringDuration)
    
    $job = Start-Job -ScriptBlock {
        param($Services, $Namespace, $EndTime, $MetricsFile)
        
        while ((Get-Date) -lt $EndTime) {
            foreach ($service in $Services) {
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                $podCount = (kubectl get pods -n $Namespace -l app=$service --no-headers 2>$null | Measure-Object).Count
                
                try {
                    $resources = kubectl top pods -n $Namespace -l app=$service --no-headers 2>$null
                    $totalCpu = 0
                    $totalMem = 0
                    
                    if ($resources) {
                        foreach ($line in $resources) {
                            $parts = $line -split '\s+'
                            if ($parts.Length -ge 3) {
                                $cpu = $parts[1] -replace 'm', ''
                                $mem = $parts[2] -replace 'Mi', ''
                                $totalCpu += [int]$cpu
                                $totalMem += [int]$mem
                            }
                        }
                    }
                    
                    "$timestamp,$service,${totalCpu}m,${totalMem}Mi,$podCount" | Out-File -FilePath $MetricsFile -Append -Encoding UTF8
                }
                catch {
                    "$timestamp,$service,N/A,N/A,$podCount" | Out-File -FilePath $MetricsFile -Append -Encoding UTF8
                }
            }
            
            Start-Sleep -Seconds 10
        }
    } -ArgumentList $Services, $Namespace, $endTime, $metricsFile
    
    return $job
}

# Verify database performance
function Test-DatabasePerformance {
    Write-Log "Verifying database performance under load..."
    
    try {
        $dbConnections = kubectl exec -n $Namespace deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>$null
        Write-Log "Active database connections: $($dbConnections.Trim())"
        
        $slowQueries = kubectl exec -n $Namespace deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds';" 2>$null
        Write-Log "Slow queries (>5s): $($slowQueries.Trim())"
        
        $dbSize = kubectl exec -n $Namespace deployment/postgres -- psql -U postgres -d krishiai_db -t -c "SELECT pg_size_pretty(pg_database_size('krishiai_db'));" 2>$null
        Write-Log "Database size: $($dbSize.Trim())"
    }
    catch {
        Write-Warning "Could not retrieve database metrics"
    }
}

# Main execution
function Main {
    Write-Host "🚀 KrishiAI MVP - Auto-scaling Verification" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    
    Test-Prerequisites
    Test-HPAConfiguration
    
    Write-Log "Starting monitoring in 10 seconds..."
    Write-Log "Make sure to start the load test now!"
    Start-Sleep -Seconds 10
    
    # Start background resource monitoring
    $metricsJob = Start-ResourceMonitoring
    
    try {
        # Monitor scaling behavior
        Start-ScalingMonitor
        
        # Final database check
        Test-DatabasePerformance
        
        Write-Success "Auto-scaling verification completed!"
        Write-Log "Check the generated report files for detailed analysis."
    }
    finally {
        # Clean up background job
        if ($metricsJob) {
            Stop-Job -Job $metricsJob -ErrorAction SilentlyContinue
            Remove-Job -Job $metricsJob -ErrorAction SilentlyContinue
        }
    }
}

# Handle script interruption
trap {
    Write-Error "Script interrupted"
    exit 1
}

# Run main function
Main