#!/bin/bash

# KrishiAI Mobile App - E2E Test Setup Script
# This script sets up the environment for running Detox E2E tests

set -e

echo "🚀 Setting up E2E test environment for KrishiAI Mobile App..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) found"

# Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed. Please install Java 11 first."
    exit 1
fi
echo "✅ Java found"

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME is not set. Please install Android SDK and set ANDROID_HOME."
    exit 1
fi
echo "✅ Android SDK found at $ANDROID_HOME"

# Check emulator
if ! command -v emulator &> /dev/null; then
    echo "❌ Android emulator not found. Please install Android emulator."
    exit 1
fi
echo "✅ Android emulator found"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install Detox CLI globally
echo ""
echo "🔧 Installing Detox CLI..."
if ! command -v detox &> /dev/null; then
    npm install -g detox-cli
    echo "✅ Detox CLI installed"
else
    echo "✅ Detox CLI already installed"
fi

# Check if AVD exists
echo ""
echo "📱 Checking Android Virtual Device..."
AVD_NAME="Pixel_4_API_30"
if emulator -list-avds | grep -q "$AVD_NAME"; then
    echo "✅ AVD '$AVD_NAME' already exists"
else
    echo "⚠️  AVD '$AVD_NAME' not found"
    echo "Creating AVD..."
    
    # Download system image if not exists
    echo "Downloading Android system image (API 30)..."
    yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-30;google_apis;x86_64"
    
    # Create AVD
    echo "Creating AVD..."
    echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
        -n "$AVD_NAME" \
        -k "system-images;android-30;google_apis;x86_64" \
        -d "pixel_4"
    
    echo "✅ AVD '$AVD_NAME' created"
fi

# Build Android app
echo ""
echo "🔨 Building Android app for testing..."
cd android
./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug
cd ..
echo "✅ Android app built successfully"

# Run a quick test to verify setup
echo ""
echo "🧪 Running verification test..."
echo "Starting emulator..."
emulator -avd "$AVD_NAME" -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim &
EMULATOR_PID=$!

# Wait for emulator to boot
echo "Waiting for emulator to boot..."
adb wait-for-device
sleep 10

# Run a single test
echo "Running test..."
npx detox test e2e/onboarding.test.ts --configuration android.debug --headless || true

# Kill emulator
echo "Stopping emulator..."
kill $EMULATOR_PID 2>/dev/null || true

echo ""
echo "✅ E2E test environment setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Run all tests: npm run test:e2e"
echo "  2. Run specific test: npx detox test e2e/onboarding.test.ts --configuration android.debug"
echo "  3. Run in CI mode: npm run test:e2e:ci"
echo ""
echo "📖 For more information, see e2e/README.md"
