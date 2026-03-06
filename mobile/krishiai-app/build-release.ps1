# Build Release APK Script for KrishiAI Mobile App
# This script builds optimized release APKs and verifies bundle size

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "KrishiAI Mobile App - Release Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "android/app/build.gradle")) {
    Write-Host "Error: Must run from mobile/krishiai-app directory" -ForegroundColor Red
    exit 1
}

# Step 1: Clean previous builds
Write-Host "[1/5] Cleaning previous builds..." -ForegroundColor Yellow
Push-Location android
.\gradlew clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Clean failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✓ Clean completed" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Build release APKs
Write-Host "[3/5] Building release APKs..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes..." -ForegroundColor Gray
Push-Location android
.\gradlew assembleRelease
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✓ Build completed" -ForegroundColor Green
Write-Host ""

# Step 4: Verify APK sizes
Write-Host "[4/5] Verifying APK sizes..." -ForegroundColor Yellow
$apkPath = "android\app\build\outputs\apk\release"
$apkFiles = Get-ChildItem "$apkPath\*.apk" -ErrorAction SilentlyContinue

if ($apkFiles.Count -eq 0) {
    Write-Host "Error: No APK files found in $apkPath" -ForegroundColor Red
    exit 1
}

$maxSizeMB = 15
$allPassed = $true

Write-Host ""
Write-Host "APK Size Report:" -ForegroundColor Cyan
Write-Host "----------------" -ForegroundColor Cyan

foreach ($apk in $apkFiles) {
    $sizeMB = [math]::Round($apk.Length / 1MB, 2)
    $status = if ($sizeMB -le $maxSizeMB) { "✓ PASS" } else { "✗ FAIL" }
    $color = if ($sizeMB -le $maxSizeMB) { "Green" } else { "Red" }
    
    Write-Host "$($apk.Name): $sizeMB MB - $status" -ForegroundColor $color
    
    if ($sizeMB -gt $maxSizeMB) {
        $allPassed = $false
    }
}

Write-Host ""
Write-Host "Target: <$maxSizeMB MB per APK" -ForegroundColor Gray
Write-Host ""

if (-not $allPassed) {
    Write-Host "Warning: Some APKs exceed the $maxSizeMB MB target" -ForegroundColor Yellow
    Write-Host "Consider additional optimizations or review included assets" -ForegroundColor Yellow
}

# Step 5: Generate build summary
Write-Host "[5/5] Generating build summary..." -ForegroundColor Yellow

$summaryPath = "build-summary.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$summary = @"
KrishiAI Mobile App - Release Build Summary
===========================================
Build Date: $timestamp

APK Files:
----------
"@

foreach ($apk in $apkFiles) {
    $sizeMB = [math]::Round($apk.Length / 1MB, 2)
    $summary += "`n$($apk.Name): $sizeMB MB"
}

$summary += @"


Optimizations Applied:
----------------------
✓ Hermes JavaScript Engine enabled
✓ ProGuard minification enabled
✓ Resource shrinking enabled
✓ APK splitting by ABI (armeabi-v7a, arm64-v8a)
✓ Code splitting and lazy loading
✓ RAM bundling enabled
✓ Vector drawable support

Build Configuration:
--------------------
- Min SDK: 26 (Android 8.0)
- Target SDK: 33 (Android 13)
- Build Type: Release
- Signing: Debug keystore (replace with production keystore for production)

APK Locations:
--------------
$apkPath

Next Steps:
-----------
1. Test APKs on physical devices (2GB RAM recommended)
2. Verify app startup time (<3s target)
3. Check memory usage during operation (<150MB target)
4. Replace debug keystore with production keystore
5. Upload to Google Play Console for internal testing

For production release:
-----------------------
1. Generate production keystore
2. Update signing config in android/app/build.gradle
3. Build with production keystore
4. Test thoroughly on multiple devices
5. Upload to Google Play Console
"@

$summary | Out-File -FilePath $summaryPath -Encoding UTF8
Write-Host "✓ Build summary saved to $summaryPath" -ForegroundColor Green
Write-Host ""

# Final status
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✓ Build Successful - All APKs within size target" -ForegroundColor Green
} else {
    Write-Host "⚠ Build Completed with Warnings" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK files location: $apkPath" -ForegroundColor Cyan
Write-Host "Build summary: $summaryPath" -ForegroundColor Cyan
Write-Host ""

# Open APK folder
$openFolder = Read-Host "Open APK folder? (Y/N)"
if ($openFolder -eq "Y" -or $openFolder -eq "y") {
    Invoke-Item $apkPath
}

Write-Host ""
Write-Host "Build process completed!" -ForegroundColor Green
