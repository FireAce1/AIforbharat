# Script to integrate Sentry into all Node.js services
Write-Host "Integrating Sentry into Node.js services..." -ForegroundColor Green

# Services to update
$services = @('climate-service', 'govt-service')

foreach ($service in $services) {
    Write-Host "`nProcessing $service..." -ForegroundColor Cyan
    
    # Check if service exists
    if (-not (Test-Path ".\$service")) {
        Write-Host "  Service $service not found, skipping..." -ForegroundColor Yellow
        continue
    }
    
    # Update config to add sentryDsn
    $configPath = ".\$service\src\config\index.ts"
    if (Test-Path $configPath) {
        $configContent = Get-Content $configPath -Raw
        if ($configContent -notmatch "sentryDsn") {
            Write-Host "  Adding sentryDsn to config..." -ForegroundColor Yellow
            $configContent = $configContent -replace "nodeEnv: process\.env\.NODE_ENV \|\| 'development',", "nodeEnv: process.env.NODE_ENV || 'development',`n  sentryDsn: process.env.SENTRY_DSN || '',"
            Set-Content $configPath $configContent -NoNewline
            Write-Host "  ✓ Config updated" -ForegroundColor Green
        } else {
            Write-Host "  Config already has sentryDsn" -ForegroundColor Gray
        }
    }
    
    # Update .env.example to add SENTRY_DSN
    $envExamplePath = ".\$service\.env.example"
    if (Test-Path $envExamplePath) {
        $envContent = Get-Content $envExamplePath -Raw
        if ($envContent -notmatch "SENTRY_DSN") {
            Write-Host "  Adding SENTRY_DSN to .env.example..." -ForegroundColor Yellow
            Add-Content $envExamplePath "`n# Sentry Error Tracking`nSENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id"
            Write-Host "  ✓ .env.example updated" -ForegroundColor Green
        } else {
            Write-Host "  .env.example already has SENTRY_DSN" -ForegroundColor Gray
        }
    }
}

Write-Host "`n✓ Sentry integration complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Install Sentry dependencies: cd services/shared && npm install" -ForegroundColor White
Write-Host "2. Update each service's index.ts to initialize Sentry" -ForegroundColor White
Write-Host "3. Add SENTRY_DSN to each service's .env file" -ForegroundColor White
Write-Host "4. Test error tracking by triggering an error" -ForegroundColor White
