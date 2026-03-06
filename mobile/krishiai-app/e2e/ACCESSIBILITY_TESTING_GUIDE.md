# KrishiAI Accessibility Testing Guide

## Overview

This guide provides comprehensive instructions for testing the accessibility features of the KrishiAI mobile application. The testing suite validates compliance with Requirements 14.1-14.5 from the KrishiAI MVP specification.

## Requirements Coverage

### Requirement 14.1: Navigation Depth
**Target:** Maximum 3 taps to reach any feature

All primary features must be accessible within 3 taps from the home screen:
- Disease detection: 1 tap
- Crop recommendation: 1 tap
- Market prices: 1 tap (tab navigation)
- Weather forecast: 1 tap (tab navigation)
- Government schemes: 1 tap (tab navigation)
- Chatbot: 1 tap (tab navigation)
- Settings: 2 taps (menu → settings)

### Requirement 14.2: High Contrast UI and Font Size
**Target:** Minimum 16sp font size, high contrast colors

- All text elements use minimum 16sp font size
- High contrast color palette for sunlight readability
- Material Design components with WCAG AA compliance
- Contrast ratio: 4.5:1 for normal text, 3:1 for large text

### Requirement 14.3: Voice Input for All Text Fields
**Target:** Voice input available for all text entry

- Phone number input: Voice button
- Chatbot queries: Voice button
- Search fields: Voice button
- Supports Hindi and Marathi voice recognition
- On-device Google Speech-to-Text

### Requirement 14.4: Error Messages in Plain Language
**Target:** Clear error messages in user's language

- Error messages in Hindi and Marathi
- Plain language (no technical jargon)
- Contextual help for resolution
- Network errors show offline indicators

### Requirement 14.5: Touch Target Sizes
**Target:** Minimum 48x48dp for all interactive elements

- All buttons: ≥48x48dp
- Tab bar items: ≥48x48dp
- List items: ≥48x48dp
- Icon buttons: ≥48x48dp

## Test Environment Setup

### Prerequisites

1. **Development Environment**
   - Node.js 18+
   - Android SDK (API 26+)
   - Java 11
   - Android Emulator or physical device

2. **Install Dependencies**
   ```bash
   cd mobile/krishiai-app
   npm install
   ```

3. **Build Android App**
   ```bash
   cd android
   ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
   cd ..
   ```

4. **Create Android Emulator**
   ```bash
   avdmanager create avd -n Pixel_4_API_30 \
     -k "system-images;android-30;google_apis;x86_64" \
     -d pixel_4
   ```

### Android Accessibility Scanner Setup

1. Install from Google Play Store:
   https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor

2. Enable Accessibility Scanner:
   - Settings → Accessibility → Accessibility Scanner → On

3. Grant necessary permissions

## Running Tests

### Quick Start

**Linux/macOS:**
```bash
cd mobile/krishiai-app
chmod +x e2e/run-accessibility-tests.sh
./e2e/run-accessibility-tests.sh
```

**Windows:**
```powershell
cd mobile/krishiai-app
.\e2e\run-accessibility-tests.ps1
```

### Run Specific Test Suites

**Navigation Depth Tests:**
```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --grep "Navigation Depth"
```

**Touch Target Tests:**
```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --grep "Touch Target Sizes"
```

**Voice Input/Output Tests:**
```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --grep "Voice Input/Output"
```

**Performance Tests (Low-End Device):**
```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --grep "Low-End Device Performance"
```

**Network Tests (2G Simulation):**
```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --grep "Slow Network Performance"
```

### Run All Accessibility Tests

```bash
npx detox test e2e/accessibility.test.ts \
  --configuration android.debug \
  --loglevel info \
  --record-logs all \
  --take-screenshots failing \
  --artifacts-location ./e2e/artifacts/accessibility
```

## Manual Testing Procedures

### 1. Android Accessibility Scanner

**Purpose:** Identify accessibility issues using Google's automated scanner

**Steps:**
1. Launch KrishiAI app on emulator/device
2. Open Android Accessibility Scanner app
3. Tap the blue checkmark button to start scanning
4. Navigate through all KrishiAI screens:
   - Home screen
   - Disease detection
   - Crop recommendation
   - Market prices
   - Weather forecast
   - Government schemes
   - Chatbot
   - Settings
5. Review suggestions for each screen
6. Document issues in test report

**Common Issues to Check:**
- Touch target size too small
- Low contrast text
- Missing content descriptions
- Clickable items without labels

### 2. High Contrast Testing (Sunlight Simulation)

**Purpose:** Verify UI readability in bright sunlight conditions

**Steps:**
1. Set device brightness to maximum
2. Enable outdoor mode (if available)
3. Navigate through all screens
4. Verify all text is readable
5. Check button visibility
6. Verify color contrast

**Test Checklist:**
- [ ] Home screen widgets readable
- [ ] Button text clearly visible
- [ ] Data tables/lists readable
- [ ] Icons distinguishable
- [ ] Error messages visible
- [ ] Loading indicators visible

### 3. Voice Input Testing (Hindi)

**Purpose:** Verify Hindi voice recognition works correctly

**Steps:**
1. Set app language to Hindi
2. Navigate to chatbot screen
3. Tap voice input button
4. Speak test queries in Hindi:
   - "मौसम कैसा है?" (How is the weather?)
   - "टमाटर का भाव क्या है?" (What is the tomato price?)
   - "फसल की सिफारिश दो" (Give crop recommendation)
5. Verify text is recognized correctly
6. Verify response is in Hindi

**Test Queries:**
- Weather: "मौसम कैसा है?"
- Prices: "टमाटर का भाव क्या है?"
- Crop: "कौन सी फसल लगाऊं?"
- Disease: "पत्तियों पर धब्बे हैं"
- Schemes: "सरकारी योजना बताओ"

### 4. Voice Input Testing (Marathi)

**Purpose:** Verify Marathi voice recognition works correctly

**Steps:**
1. Set app language to Marathi
2. Navigate to chatbot screen
3. Tap voice input button
4. Speak test queries in Marathi:
   - "हवामान कसे आहे?" (How is the weather?)
   - "टोमॅटोचा भाव काय आहे?" (What is the tomato price?)
   - "पीक शिफारस द्या" (Give crop recommendation)
5. Verify text is recognized correctly
6. Verify response is in Marathi

**Test Queries:**
- Weather: "हवामान कसे आहे?"
- Prices: "टोमॅटोचा भाव काय आहे?"
- Crop: "कोणते पीक लावावे?"
- Disease: "पानांवर डाग आहेत"
- Schemes: "सरकारी योजना सांगा"

### 5. Low-End Device Testing (2GB RAM)

**Purpose:** Verify app performance on low-end devices

**Test Device Specifications:**
- RAM: 2GB
- Storage: 16GB
- Android: 8.0 (API 26)
- Screen: 4.5-6.5 inches

**Performance Targets:**
- App launch: < 3 seconds
- Disease detection inference: < 2 seconds
- Screen navigation: < 1 second
- No crashes or ANRs

**Steps:**
1. Install app on low-end device
2. Measure cold launch time
3. Navigate through all screens
4. Perform disease detection
5. Test offline functionality
6. Monitor memory usage
7. Check for crashes

### 6. Slow Network Testing (2G Simulation)

**Purpose:** Verify graceful degradation on slow networks

**Network Conditions:**
- Speed: 50 kbps
- Latency: 300-500ms
- Packet loss: 5-10%

**Steps:**
1. Enable 2G network simulation
2. Launch app
3. Verify loading indicators appear
4. Check cached data is used
5. Verify offline indicators
6. Test sync queue functionality
7. Restore normal network
8. Verify auto-sync works

**Test Scenarios:**
- [ ] Fetch crop recommendations
- [ ] Load market prices
- [ ] Get weather forecast
- [ ] Search government schemes
- [ ] Send chatbot query
- [ ] Perform disease detection
- [ ] Sync offline actions

### 7. Touch Target Size Verification

**Purpose:** Verify all interactive elements meet 48x48dp minimum

**Manual Measurement:**
1. Enable "Show layout bounds" in Developer Options
2. Take screenshots of all screens
3. Measure touch targets using design tools
4. Verify ≥48x48dp for all interactive elements

**Elements to Check:**
- [ ] Primary action buttons
- [ ] Tab bar items
- [ ] List items
- [ ] Icon buttons
- [ ] Dropdown selectors
- [ ] Radio buttons
- [ ] Checkboxes
- [ ] Toggle switches

### 8. Font Size Verification

**Purpose:** Verify all text meets 16sp minimum

**Steps:**
1. Enable "Show font size" in Developer Options
2. Navigate through all screens
3. Check text elements
4. Verify ≥16sp for all text

**Text Elements to Check:**
- [ ] Screen titles
- [ ] Button labels
- [ ] Body text
- [ ] List items
- [ ] Input field labels
- [ ] Error messages
- [ ] Tab labels
- [ ] Card content

## Test Artifacts

### Generated Files

After running tests, the following artifacts are generated:

```
e2e/artifacts/accessibility/
├── ACCESSIBILITY_TEST_REPORT.md    # Comprehensive test report
├── screenshots/                     # Screenshots of failures
│   ├── navigation-depth-*.png
│   ├── touch-targets-*.png
│   └── voice-input-*.png
├── device-logs/                     # Android device logs
│   └── device.log
└── test-results/                    # JUnit XML reports
    └── results.xml
```

### Test Report Contents

The generated report includes:
- Test summary with pass/fail status
- Requirements coverage analysis
- Performance metrics
- Network performance results
- Voice I/O test results
- Android Accessibility Scanner findings
- Recommendations for improvements
- Next steps

## Troubleshooting

### Common Issues

**1. Emulator Not Starting**
```bash
# List available emulators
emulator -list-avds

# Start emulator manually
emulator -avd Pixel_4_API_30
```

**2. Build Failures**
```bash
# Clean Gradle cache
cd android
./gradlew clean

# Rebuild
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
```

**3. Test Timeouts**
- Increase timeout in `e2e/jest.config.js`
- Check emulator performance
- Ensure sufficient system resources

**4. Voice Recognition Not Working**
- Verify Google Speech-to-Text is installed
- Check microphone permissions
- Ensure language packs are downloaded

**5. Network Simulation Issues**
```bash
# Reset network blacklist
await device.setURLBlacklist([]);
```

**6. Accessibility Scanner Not Found**
- Install from Google Play Store
- Enable in Accessibility settings
- Grant necessary permissions

## Best Practices

### Test Design

1. **Independence:** Each test should be independent
2. **Clean State:** Use `beforeAll` and `beforeEach` for setup
3. **Explicit Waits:** Always use `waitFor` instead of delays
4. **Descriptive IDs:** Use clear testIDs in components
5. **Error Handling:** Test both success and error scenarios

### Accessibility Guidelines

1. **Touch Targets:** Minimum 48x48dp for all interactive elements
2. **Font Size:** Minimum 16sp for all text
3. **Contrast:** 4.5:1 for normal text, 3:1 for large text
4. **Labels:** All interactive elements have accessibility labels
5. **Focus:** Logical focus order for keyboard navigation
6. **Feedback:** Visual and audio feedback for actions

### Performance Guidelines

1. **Launch Time:** < 3 seconds on 2GB RAM devices
2. **Inference:** < 2 seconds for disease detection
3. **Navigation:** < 1 second between screens
4. **Memory:** < 200MB RAM usage
5. **Battery:** Minimal battery drain

## Continuous Integration

### GitHub Actions Integration

The accessibility tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests
- Nightly builds

### CI Configuration

```yaml
# .github/workflows/accessibility-tests.yml
name: Accessibility Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  accessibility:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions/setup-java@v3
      
      - name: Install dependencies
        run: npm install
        
      - name: Build Android app
        run: |
          cd android
          ./gradlew assembleDebug assembleAndroidTest
          
      - name: Run accessibility tests
        run: ./e2e/run-accessibility-tests.sh
        
      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: accessibility-test-artifacts
          path: e2e/artifacts/accessibility/
```

## Reporting Issues

### Issue Template

When reporting accessibility issues, include:

1. **Requirement:** Which requirement is violated (14.1-14.5)
2. **Screen:** Which screen has the issue
3. **Element:** Specific UI element affected
4. **Expected:** What should happen
5. **Actual:** What actually happens
6. **Screenshots:** Visual evidence
7. **Device:** Device/emulator specifications
8. **Steps:** Steps to reproduce

### Example Issue

```markdown
**Requirement:** 14.5 (Touch Target Sizes)
**Screen:** Market Prices
**Element:** Price trend icon buttons
**Expected:** Touch target ≥48x48dp
**Actual:** Touch target is 40x40dp
**Device:** Pixel 4 Emulator, API 30
**Steps:**
1. Navigate to Market Prices screen
2. Observe trend icon buttons
3. Measure touch target size
**Screenshot:** [attached]
```

## Resources

### Documentation
- [Detox Documentation](https://wix.github.io/Detox/)
- [Android Accessibility](https://developer.android.com/guide/topics/ui/accessibility)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Accessibility](https://material.io/design/usability/accessibility.html)

### Tools
- [Android Accessibility Scanner](https://play.google.com/store/apps/details?id=com.google.android.apps.accessibility.auditor)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Blindness Simulator](https://www.color-blindness.com/coblis-color-blindness-simulator/)

### Testing Frameworks
- [Detox](https://github.com/wix/Detox)
- [Jest](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)

## Maintenance

### Updating Tests

When adding new features:
1. Add testIDs to new components
2. Create accessibility tests
3. Update this guide
4. Run full test suite
5. Update CI configuration

### Regular Reviews

Conduct accessibility reviews:
- Before each release
- After major UI changes
- Quarterly comprehensive audits
- User feedback sessions

## Contact

For questions or issues with accessibility testing:
- Create an issue in the repository
- Contact the QA team
- Refer to the main README

---

**Last Updated:** January 2026
**Version:** 1.0
**Maintained by:** KrishiAI QA Team
