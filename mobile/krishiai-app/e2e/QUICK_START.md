# E2E Tests - Quick Start Guide

## Prerequisites

- macOS (for Android emulator support)
- Node.js 18+
- Java 11
- Android SDK with API 30
- Android Emulator

## Setup (5 minutes)

### Option 1: Automated Setup (Recommended)

**On macOS/Linux:**
```bash
cd mobile/krishiai-app
chmod +x setup-e2e-tests.sh
./setup-e2e-tests.sh
```

**On Windows:**
```powershell
cd mobile/krishiai-app
.\setup-e2e-tests.ps1
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Detox CLI
npm install -g detox-cli

# 3. Create Android emulator
avdmanager create avd -n Pixel_4_API_30 \
  -k "system-images;android-30;google_apis;x86_64" \
  -d pixel_4

# 4. Build Android app
cd android
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
cd ..
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
# Onboarding
npx detox test e2e/onboarding.test.ts --configuration android.debug

# Disease Detection
npx detox test e2e/disease-detection.test.ts --configuration android.debug

# Crop Recommendation
npx detox test e2e/crop-recommendation.test.ts --configuration android.debug

# Offline Functionality
npx detox test e2e/offline-functionality.test.ts --configuration android.debug

# Sync After Reconnection
npx detox test e2e/sync-after-reconnection.test.ts --configuration android.debug
```

### Run in CI Mode (Headless)
```bash
npm run test:e2e:ci
```

### Debug Mode
```bash
npx detox test --configuration android.debug --loglevel trace
```

## Test Results

### Success Output
```
✓ should complete full onboarding flow (45s)
✓ should show validation errors for invalid phone number (5s)
✓ should allow OTP resend after 30 seconds (35s)

Test Suites: 5 passed, 5 total
Tests:       35 passed, 35 total
Time:        4m 32s
```

### Artifacts (on failure)
- Screenshots: `artifacts/screenshots/`
- Device logs: `artifacts/device-logs/`
- Test results: `e2e/test-results/`

## Common Issues

### Emulator not starting
```bash
# List available emulators
emulator -list-avds

# Start manually
emulator -avd Pixel_4_API_30
```

### Build failures
```bash
cd android
./gradlew clean
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
```

### Port conflicts
```bash
# Kill existing Metro bundler
npx react-native start --reset-cache
```

## CI/CD

Tests run automatically on GitHub Actions:
- Push to main/develop branches
- Pull requests to main/develop
- When mobile app files change

View results: GitHub Actions → E2E Tests workflow

## Next Steps

1. ✅ Setup complete
2. ✅ Run tests locally
3. ✅ Review test results
4. 📖 Read full documentation: `e2e/README.md`
5. 🔧 Customize tests for your needs

## Support

- Full documentation: `e2e/README.md`
- Implementation details: `TASK_16.2_IMPLEMENTATION.md`
- Test helpers: `e2e/setup.ts`

## Test Coverage Summary

| Feature | Tests | Status |
|---------|-------|--------|
| Onboarding | 5 | ✅ |
| Disease Detection | 7 | ✅ |
| Crop Recommendation | 8 | ✅ |
| Offline Functionality | 7 | ✅ |
| Sync After Reconnection | 8 | ✅ |
| **Total** | **35** | **✅** |

**Estimated execution time:** < 5 minutes
