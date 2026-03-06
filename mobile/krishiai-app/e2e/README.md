# E2E Tests for KrishiAI Mobile App

This directory contains end-to-end tests for the KrishiAI mobile application using Detox testing framework.

## Test Coverage

### 1. Onboarding Flow (`onboarding.test.ts`)
- Complete onboarding: phone → OTP → language → farm profile → home screen
- Phone number validation
- OTP resend functionality (30-second timer)
- Invalid OTP handling
- Land size unit conversion (hectares/acres)

### 2. Disease Detection (`disease-detection.test.ts`)
- Complete flow: open camera → capture → view results → save
- Photo retake functionality
- Confidence score display (percentage)
- Severity level display (Early/Moderate/Severe)
- Offline functionality (on-device AI)
- Camera permission handling
- Loading indicators during inference

### 3. Crop Recommendation (`crop-recommendation.test.ts`)
- Complete flow: request → view results → select crop
- Top 3 recommendations with ranking badges
- Confidence scores as progress bars
- Risk level display (Low/Medium/High)
- 24-hour caching
- "Last updated" timestamps
- Financial metrics display (₹ symbol)
- Navigation between recommendation cards

### 4. Offline Functionality (`offline-functionality.test.ts`)
- Cached data access when offline
- "Last updated" timestamps for all cached data
- Offline indicator display
- Action queuing when offline
- Stale cache handling
- Data persistence across app restarts
- Error messages for uncached data

### 5. Sync After Reconnection (`sync-after-reconnection.test.ts`)
- Automatic sync when network reconnects
- Sync progress indicators
- Priority-based sync queue processing (CRITICAL→HIGH→MEDIUM→LOW)
- Retry logic with exponential backoff
- Conflict resolution (last-write-wins)
- Last sync timestamp updates
- Manual sync from settings
- Pending items count badge

## Prerequisites

### System Requirements
- macOS (for Android emulator)
- Node.js 18+
- Java 11
- Android SDK
- Android Emulator (API 30, Pixel 4)

### Installation

1. Install Detox CLI globally:
```bash
npm install -g detox-cli
```

2. Install dependencies:
```bash
cd mobile/krishiai-app
npm install
```

3. Build the Android app:
```bash
cd android
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
```

4. Create Android emulator (if not exists):
```bash
avdmanager create avd -n Pixel_4_API_30 -k "system-images;android-30;google_apis;x86_64" -d pixel_4
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test suite
```bash
npx detox test e2e/onboarding.test.ts --configuration android.debug
npx detox test e2e/disease-detection.test.ts --configuration android.debug
npx detox test e2e/crop-recommendation.test.ts --configuration android.debug
npx detox test e2e/offline-functionality.test.ts --configuration android.debug
npx detox test e2e/sync-after-reconnection.test.ts --configuration android.debug
```

### Run tests in headless mode (CI)
```bash
npx detox test --configuration android.debug --headless
```

### Run tests on attached device
```bash
npx detox test --configuration android.attached
```

### Debug mode
```bash
npx detox test --configuration android.debug --loglevel trace
```

## Test Configuration

### Detox Configuration (`.detoxrc.js`)
- **Apps**: Debug and release APK configurations
- **Devices**: Emulator and attached device configurations
- **Test Runner**: Jest with 120-second timeout

### Jest Configuration (`e2e/jest.config.js`)
- **Test Match**: All `*.test.ts` files in `e2e/` directory
- **Timeout**: 120 seconds per test
- **Max Workers**: 1 (sequential execution)
- **Preset**: TypeScript with ts-jest

## CI/CD Integration

### GitHub Actions
The E2E tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Only when mobile app files change

Workflow file: `e2e/ci-setup.yml`

### CI Pipeline Steps
1. Checkout code
2. Setup Node.js, Java, and Android SDK
3. Install dependencies
4. Cache Gradle and AVD
5. Build Android app
6. Run Detox tests on emulator
7. Upload test artifacts (on failure)

## Test Helpers

### Available Helper Functions (`setup.ts`)
- `waitForElement(elementId, timeout)` - Wait for element to be visible
- `typeText(elementId, text)` - Type text into input field
- `tapButton(elementId)` - Tap button or touchable element
- `scrollToElement(scrollViewId, elementId)` - Scroll to element
- `expectElementToBeVisible(elementId)` - Assert element is visible
- `expectElementToHaveText(elementId, text)` - Assert element has text
- `disableNetwork()` - Disable network connectivity
- `enableNetwork()` - Enable network connectivity
- `clearAppData()` - Clear app data and restart

## Test Data

### Test OTP
For testing purposes, use OTP: `123456`

### Test Phone Numbers
- Valid: `9876543210`
- Invalid (too short): `12345`

### Test Coordinates
- Mumbai: `19.0760, 72.8777`

## Troubleshooting

### Emulator not starting
```bash
# List available emulators
emulator -list-avds

# Start emulator manually
emulator -avd Pixel_4_API_30
```

### Build failures
```bash
# Clean Gradle cache
cd android
./gradlew clean

# Rebuild
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
```

### Test timeouts
- Increase timeout in `e2e/jest.config.js`
- Check emulator performance
- Ensure sufficient system resources

### Network simulation issues
```bash
# Reset network blacklist
await device.setURLBlacklist([]);
```

## Best Practices

1. **Test Independence**: Each test should be independent and not rely on other tests
2. **Clean State**: Use `beforeAll` and `beforeEach` to ensure clean state
3. **Explicit Waits**: Always use `waitFor` instead of arbitrary delays
4. **Descriptive IDs**: Use clear, descriptive testIDs in components
5. **Error Handling**: Test both success and error scenarios
6. **Offline Testing**: Test offline functionality thoroughly
7. **Performance**: Keep tests fast by minimizing unnecessary waits

## Test Maintenance

### Adding New Tests
1. Create new test file in `e2e/` directory
2. Import setup helpers
3. Follow existing test structure
4. Add testIDs to new components
5. Update this README

### Updating Tests
- Keep tests in sync with UI changes
- Update testIDs when components change
- Verify tests pass after updates

## Performance Metrics

### Target Execution Times
- Onboarding flow: < 60 seconds
- Disease detection: < 30 seconds
- Crop recommendation: < 30 seconds
- Offline functionality: < 90 seconds
- Sync after reconnection: < 90 seconds

### Total Suite Execution
- Target: < 5 minutes
- CI timeout: 60 minutes

## Reporting

### Test Results
- Console output during execution
- JUnit XML reports in `e2e/test-results/`
- Screenshots on failure in `artifacts/`

### Artifacts
- Screenshots: `artifacts/screenshots/`
- Device logs: `artifacts/device-logs/`
- Test videos: `artifacts/videos/` (if enabled)

## References

- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
