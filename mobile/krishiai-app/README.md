# KrishiAI Mobile App

AI-powered agricultural intelligence platform for Indian farmers.

## Overview

KrishiAI is an offline-first, voice-enabled mobile application optimized for low-end Android devices (2GB RAM). It provides crop recommendations, disease detection, market intelligence, weather forecasts, and government scheme information.

## Technology Stack

- **Framework**: React Native 0.73.2
- **Language**: TypeScript
- **State Management**: Redux Toolkit + Redux Saga
- **Navigation**: React Navigation
- **Offline Storage**: WatermelonDB (to be added in Task 3.3)
- **AI/ML**: TensorFlow Lite (to be added in Task 5.3)

## Project Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── services/       # API clients and business logic
├── store/          # Redux store, slices, and sagas
├── utils/          # Utility functions and helpers
├── types/          # TypeScript type definitions
└── App.tsx         # Main app component
```

## Requirements

- Node.js >= 18
- React Native CLI
- Android SDK (minSdkVersion 26, targetSdkVersion 33)
- JDK 11 or higher

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install iOS dependencies (macOS only):
```bash
cd ios && pod install && cd ..
```

3. Start Metro bundler:
```bash
npm start
```

4. Run on Android:
```bash
npm run android
```

5. Run on iOS (macOS only):
```bash
npm run ios
```

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npx tsc --noEmit
```

## Android Configuration

- **minSdkVersion**: 26 (Android 8.0)
- **targetSdkVersion**: 33 (Android 13)
- **Optimizations**: 
  - Hermes engine enabled for better performance
  - ProGuard enabled for release builds
  - Bundle splitting for optimal loading
  - 2GB RAM optimization

## Features (Planned)

- [x] Task 3.1: Project initialization with TypeScript
- [ ] Task 3.2: Redux state management with offline persistence
- [ ] Task 3.3: WatermelonDB for offline-first data storage
- [ ] Task 3.4: API client with offline queue support
- [ ] Task 4.1: Multi-language support (Hindi, Marathi)
- [ ] Task 4.2: Voice input/output integration
- [ ] Task 5.3: TensorFlow Lite integration for disease detection
- [ ] Task 10.1: Navigation and onboarding flow

## Performance Targets

- Cold start: < 3 seconds on 2GB RAM devices
- Disease detection: < 2 seconds on-device
- Monthly data usage: < 5MB
- Offline functionality: 100% for core features

## License

Proprietary - KrishiAI Platform
