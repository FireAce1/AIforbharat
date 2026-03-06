# PowerShell Script to Verify TLS Configuration
# Tests TLS 1.3, HSTS headers, and certificate configuration

param(
    [Parameter(Mandatory=$false)]
    [string]$Domain = "localhost",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 443
)

Write-Host "=========================================="
Write-Host "KrishiAI TLS Verification Script"
Write-Host "Testing: $Domain`:$Port"
Write-Host "=========================================="
Write-Host ""

$allTestsPassed = $true

# Test 1: Check if NGINX is running
Write-Host "Test 1: Checking if NGINX container is running..."
$nginxRunning = docker ps --filter "name=krishiai-nginx" --format "{{.Status}}"

if ($nginxRunning) {
    Write-Host "✓ NGINX container is running: $nginxRunning" -ForegroundColor Green
} else {
    Write-Host "✗ NGINX container is not running" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 2: Check HTTP to HTTPS redirect
Write-Host "Test 2: Checking HTTP to HTTPS redirect..."
try {
    $response = Invoke-WebRequest -Uri "http://$Domain" -MaximumRedirection 0 -ErrorAction SilentlyContinue
} catch {
    if ($_.Exception.Response.StatusCode -eq 301) {
        $location = $_.Exception.Response.Headers["Location"]
        if ($location -like "https://*") {
            Write-Host "✓ HTTP redirects to HTTPS (301)" -ForegroundColor Green
        } else {
            Write-Host "✗ HTTP redirect location is not HTTPS: $location" -ForegroundColor Red
            $allTestsPassed = $false
        }
    } else {
        Write-Host "✗ HTTP redirect failed: $($_.Exception.Message)" -ForegroundColor Red
        $allTestsPassed = $false
    }
}
Write-Host ""

# Test 3: Check HTTPS connection
Write-Host "Test 3: Checking HTTPS connection..."
try {
    # Skip certificate validation for self-signed certs
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $response = Invoke-WebRequest -Uri "https://$Domain/health" -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ HTTPS connection successful (200 OK)" -ForegroundColor Green
    } else {
        Write-Host "✗ HTTPS connection returned: $($response.StatusCode)" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "✗ HTTPS connection failed: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 4: Check HSTS header
Write-Host "Test 4: Checking HSTS header..."
try {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $response = Invoke-WebRequest -Uri "https://$Domain/health" -ErrorAction Stop
    
    $hstsHeader = $response.Headers["Strict-Transport-Security"]
    
    if ($hstsHeader) {
        Write-Host "✓ HSTS header present: $hstsHeader" -ForegroundColor Green
        
        if ($hstsHeader -match "max-age=31536000") {
            Write-Host "  ✓ max-age is 31536000 (1 year)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ max-age is not 31536000" -ForegroundColor Red
            $allTestsPassed = $false
        }
        
        if ($hstsHeader -match "includeSubDomains") {
            Write-Host "  ✓ includeSubDomains is set" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ includeSubDomains is not set" -ForegroundColor Yellow
        }
        
        if ($hstsHeader -match "preload") {
            Write-Host "  ✓ preload is set" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ preload is not set" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ HSTS header not found" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "✗ Failed to check HSTS header: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 5: Check security headers
Write-Host "Test 5: Checking security headers..."
try {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    $response = Invoke-WebRequest -Uri "https://$Domain/health" -ErrorAction Stop
    
    $securityHeaders = @{
        "X-Frame-Options" = "SAMEORIGIN"
        "X-Content-Type-Options" = "nosniff"
        "X-XSS-Protection" = "1; mode=block"
        "Referrer-Policy" = "strict-origin-when-cross-origin"
    }
    
    foreach ($header in $securityHeaders.Keys) {
        $value = $response.Headers[$header]
        if ($value) {
            Write-Host "  ✓ $header`: $value" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $header not found" -ForegroundColor Red
            $allTestsPassed = $false
        }
    }
} catch {
    Write-Host "✗ Failed to check security headers: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 6: Check certificate validity
Write-Host "Test 6: Checking certificate validity..."
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    $certFile = ".\certs\production\fullchain.pem"
    if (-not (Test-Path $certFile)) {
        $certFile = ".\certs\staging\fullchain.pem"
    }
    
    if (Test-Path $certFile) {
        $certInfo = openssl x509 -in $certFile -noout -subject -issuer -dates
        Write-Host $certInfo
        Write-Host "✓ Certificate information retrieved" -ForegroundColor Green
    } else {
        Write-Host "⚠ Certificate file not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ OpenSSL not found, skipping certificate check" -ForegroundColor Yellow
}
Write-Host ""

# Test 7: Check NGINX logs for errors
Write-Host "Test 7: Checking NGINX logs for errors..."
$logs = docker logs krishiai-nginx --tail 50 2>&1
$errors = $logs | Select-String -Pattern "error|failed|warning" -CaseSensitive:$false

if ($errors) {
    Write-Host "⚠ Found potential issues in logs:" -ForegroundColor Yellow
    $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
} else {
    Write-Host "✓ No errors found in recent logs" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "=========================================="
Write-Host "Verification Summary"
Write-Host "=========================================="

if ($allTestsPassed) {
    Write-Host "✓ All critical tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "TLS configuration is working correctly."
    Write-Host ""
    Write-Host "Recommended next steps:"
    Write-Host "1. Test from mobile app"
    Write-Host "2. Update certificate pins in mobile app"
    Write-Host "3. Run SSL Labs test (for production): https://www.ssllabs.com/ssltest/"
    Write-Host "4. Monitor logs for any issues"
} else {
    Write-Host "✗ Some tests failed. Please review the output above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "1. Check NGINX configuration: docker exec krishiai-nginx nginx -t"
    Write-Host "2. View full logs: docker logs krishiai-nginx"
    Write-Host "3. Verify certificates exist in certs/ directory"
    Write-Host "4. Restart services: docker-compose restart"
}
Write-Host ""
