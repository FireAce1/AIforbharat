# Sentry Integration Verification Script
# This script verifies that Sentry error tracking is properly configured across all services

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Sentry Integration Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Function to check if a file exists and contains specific text
function Test-FileContains {
    param(
        [string]$FilePath,
        [string]$SearchText,
        [string]$Description
    )
    
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        if ($content -match $SearchText) {
            Write-Host "✓ $Description" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ $Description - Pattern not found" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "✗ $Description - File not found: $FilePath" -ForegroundColor Red
        return $false
    }
}

# Function to check if package.json has dependency
function Test-PackageDependency {
    param(
        [string]$PackageJsonPath,
        [string]$DependencyName,
        [string]$ServiceName
    )
    
    if (Test-Path $PackageJsonPath) {
        $packageJson = Get-Content $PackageJsonPath | ConvertFrom-Json
        if ($packageJson.dependencies.$DependencyName) {
            Write-Host "✓ $ServiceName has $DependencyName dependency" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ $ServiceName missing $DependencyName dependency" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "✗ $ServiceName package.json not found" -ForegroundColor Red
        return $false
    }
}

Write-Host "1. Checking Shared Sentry Utilities..." -ForegroundColor Yellow
Write-Host ""

$result = Test-FileContains `
    -FilePath "shared/utils/sentry.ts" `
    -SearchText "export const initializeSentry" `
    -Description "Shared Sentry utility exists with initializeSentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "shared/utils/sentry.ts" `
    -SearchText "sentryRequestHandler" `
    -Description "Shared Sentry utility has request handler"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "shared/utils/sentry.ts" `
    -SearchText "sentryErrorHandler" `
    -Description "Shared Sentry utility has error handler"
$allPassed = $allPassed -and $result

$result = Test-PackageDependency `
    -PackageJsonPath "shared/package.json" `
    -DependencyName "@sentry/node" `
    -ServiceName "Shared package"
$allPassed = $allPassed -and $result

Write-Host ""
Write-Host "2. Checking Node.js Services Integration..." -ForegroundColor Yellow
Write-Host ""

# Auth Service
$result = Test-FileContains `
    -FilePath "auth-service/src/index.ts" `
    -SearchText "initializeSentry" `
    -Description "Auth service initializes Sentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "auth-service/src/config/index.ts" `
    -SearchText "sentryDsn" `
    -Description "Auth service config has sentryDsn"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "auth-service/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Auth service .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

# Market Service
$result = Test-FileContains `
    -FilePath "market-service/src/index.ts" `
    -SearchText "initializeSentry" `
    -Description "Market service initializes Sentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "market-service/src/config/index.ts" `
    -SearchText "sentryDsn" `
    -Description "Market service config has sentryDsn"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "market-service/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Market service .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

# Climate Service
$result = Test-FileContains `
    -FilePath "climate-service/src/index.ts" `
    -SearchText "initializeSentry" `
    -Description "Climate service initializes Sentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "climate-service/src/config/index.ts" `
    -SearchText "sentryDsn" `
    -Description "Climate service config has sentryDsn"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "climate-service/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Climate service .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

# Government Service
$result = Test-FileContains `
    -FilePath "govt-service/src/index.ts" `
    -SearchText "initializeSentry" `
    -Description "Government service initializes Sentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "govt-service/src/config/index.ts" `
    -SearchText "sentryDsn" `
    -Description "Government service config has sentryDsn"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "govt-service/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Government service .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

Write-Host ""
Write-Host "3. Checking Python Service Integration..." -ForegroundColor Yellow
Write-Host ""

$result = Test-FileContains `
    -FilePath "crop-service/src/utils/sentry_config.py" `
    -SearchText "def initialize_sentry" `
    -Description "Crop service has Sentry config utility"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "crop-service/src/main.py" `
    -SearchText "initialize_sentry" `
    -Description "Crop service initializes Sentry"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "crop-service/src/config.py" `
    -SearchText "SENTRY_DSN" `
    -Description "Crop service config has SENTRY_DSN"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "crop-service/requirements.txt" `
    -SearchText "sentry-sdk" `
    -Description "Crop service requirements has sentry-sdk"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "crop-service/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Crop service .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

Write-Host ""
Write-Host "4. Checking Mobile App Integration..." -ForegroundColor Yellow
Write-Host ""

$result = Test-FileContains `
    -FilePath "../mobile/krishiai-app/src/utils/sentry.ts" `
    -SearchText "export const initializeSentry" `
    -Description "Mobile app has Sentry utility"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "../mobile/krishiai-app/src/App.tsx" `
    -SearchText "initializeSentry" `
    -Description "Mobile app initializes Sentry in App.tsx"
$allPassed = $allPassed -and $result

$result = Test-PackageDependency `
    -PackageJsonPath "../mobile/krishiai-app/package.json" `
    -DependencyName "@sentry/react-native" `
    -ServiceName "Mobile app"
$allPassed = $allPassed -and $result

$result = Test-FileContains `
    -FilePath "../mobile/krishiai-app/.env.example" `
    -SearchText "SENTRY_DSN" `
    -Description "Mobile app .env.example has SENTRY_DSN"
$allPassed = $allPassed -and $result

Write-Host ""
Write-Host "5. Checking Documentation..." -ForegroundColor Yellow
Write-Host ""

$result = Test-FileContains `
    -FilePath "TASK_14.3_IMPLEMENTATION.md" `
    -SearchText "Sentry Error Tracking Implementation" `
    -Description "Implementation documentation exists"
$allPassed = $allPassed -and $result

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "All Sentry integration checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Create Sentry projects at https://sentry.io" -ForegroundColor White
    Write-Host "2. Copy DSN from each project settings" -ForegroundColor White
    Write-Host "3. Add SENTRY_DSN to each service .env file" -ForegroundColor White
    Write-Host "4. Configure alert rules in Sentry dashboard" -ForegroundColor White
    Write-Host "5. Test error tracking by triggering test errors" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "X Some Sentry integration checks failed" -ForegroundColor Red
    Write-Host "Please review the errors above and fix them" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
