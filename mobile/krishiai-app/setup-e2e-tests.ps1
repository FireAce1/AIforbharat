# KrishiAI Mobile App - E2E Test Setup Script (PowerShell)
# This script sets up the environment for running Detox E2E tests on Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up E2E test environment for KrishiAI Mobile App..." -ForegroundColor Green

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node -v
    $nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($nodeMajorVersion -lt 18) {
        Write-Host "❌ Node.js version must be 18 or higher. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check Java
try {
    $javaVersion = java -version 2>&1
    Write-Host "✅ Java found" -ForegroundColor Green
} catch {
    Write-Host "❌ Java is not installed. Please install Java 11 first." -ForegroundColor Red
    exit 1
}

# Check Android SDK
if (-not $env:ANDROID_HOME) {
    Write-Host "❌ ANDROID_HOME is not set. Please install Android SDK and set ANDROID_HOME." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Android SDK found at $env:ANDROID_HOME" -ForegroundColor Green

# Check emulator
try {
    $emulatorPath = Join-Path $env:ANDROID_HOME "emulator\emulator.exe"
    if (-not (Test-Path $emulatorPath)) {
        throw "Emulator not found"
    }
    Write-Host "✅ Android emulator found" -ForegroundColor Green
} catch {
    Write-Host "❌ Android emulator not found. Please install Android emulator." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Cyan
npm install

# Install Detox CLI globally
Write-Host "`n🔧 Installing Detox CLI..." -ForegroundColor Cyan
try {
    detox --version | Out-Null
    Write-Host "✅ Detox CLI already installed" -ForegroundColor Green
} catch {
    npm install -g detox-cli
    Write-Host "✅ Detox CLI installed" -ForegroundColor Green
}

# Check if AVD exists
Write-Host "`n📱 Checking Android Virtual Device..." -ForegroundColor Cyan
$AVD_NAME = "Pixel_4_API_30"
$emulatorExe = Join-Path $env:ANDROID_HOME "emulator\emulator.exe"
$avdList = & $emulatorExe -list-avds

if ($avdList -contains $AVD_NAME) {
    Write-Host "✅ AVD '$AVD_NAME' already exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  AVD '$AVD_NAME' not found" -ForegroundColor Yellow
    Write-Host "Creating AVD..." -ForegroundColor Cyan
    
    # Download system image if not exists
    Write-Host "Downloading Android system image (API 30)..." -ForegroundColor Cyan
    $sdkmanager = Join-Path $env:ANDROID_HOME "cmdline-tools\latest\bin\sdkmanager.bat"
    & $sdkmanager "system-images;android-30;google_apis;x86_64"
    
    # Create AVD
    Write-Host "Creating AVD..." -ForegroundColor Cyan
    $avdmanager = Join-Path $env:ANDROID_HOME "cmdline-tools\latest\bin\avdmanager.bat"
    echo "no" | & $avdmanager create avd `
        -n $AVD_NAME `
        -k "system-images;android-30;google_apis;x86_64" `
        -d "pixel_4"
    
    Write-Host "✅ AVD '$AVD_NAME' created" -ForegroundColor Green
}

# Build Android app
Write-Host "`n🔨 Building Android app for testing..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug
Pop-Location
Write-Host "✅ Android app built successfully" -ForegroundColor Green

Write-Host "`n✅ E2E test environment setup complete!" -ForegroundColor Green
Write-Host "`n📚 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run all tests: npm run test:e2e"
Write-Host "  2. Run specific test: npx detox test e2e/onboarding.test.ts --configuration android.debug"
Write-Host "  3. Run in CI mode: npm run test:e2e:ci"
Write-Host "`n📖 For more information, see e2e/README.md"
