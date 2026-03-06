import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  tapButton,
  expectElementToBeVisible,
  disableNetwork,
  enableNetwork
} from './setup';

describe('Offline Functionality', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should use cached data when offline: disable network → use features → verify cached data', async () => {
    // First, load data while online
    await waitForElement('home-screen');
    
    // Load weather data
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await expectElementToBeVisible('weather-forecast-list');
    await device.pressBack();
    
    // Load market prices
    await tapButton('market-widget');
    await waitForElement('market-prices-screen', 5000);
    await expectElementToBeVisible('market-prices-list');
    await device.pressBack();
    
    // Get crop recommendations
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    await tapButton('get-recommendations-button');
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    await device.pressBack();
    
    await waitForElement('home-screen');
    
    // Now disable network
    await disableNetwork();
    
    // Verify offline indicator is shown
    await expectElementToBeVisible('offline-indicator');
    
    // Test 1: Weather data should be available offline
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await expectElementToBeVisible('weather-forecast-list');
    await expectElementToBeVisible('cached-data-indicator');
    await expectElementToBeVisible('last-updated-text');
    
    // Verify data is displayed
    await expectElementToBeVisible('weather-day-1');
    await device.pressBack();
    
    // Test 2: Market prices should be available offline
    await tapButton('market-widget');
    await waitForElement('market-prices-screen', 5000);
    await expectElementToBeVisible('market-prices-list');
    await expectElementToBeVisible('cached-data-indicator');
    
    // Verify prices are displayed
    await expectElementToBeVisible('price-item-1');
    await device.pressBack();
    
    // Test 3: Crop recommendations should be available offline
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    await expectElementToBeVisible('recommendation-results');
    await expectElementToBeVisible('cached-data-indicator');
    
    // Verify recommendations are displayed
    await expectElementToBeVisible('recommendation-card-1');
    await device.pressBack();
    
    // Test 4: Disease detection should work offline (on-device AI)
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    await waitForElement('image-preview', 3000);
    await tapButton('confirm-image-button');
    
    // Should complete inference offline
    await waitFor(element(by.id('disease-results')))
      .toBeVisible()
      .withTimeout(3000);
    await expectElementToBeVisible('disease-name-text');
    
    // Save should add to sync queue
    await tapButton('save-detection-button');
    await expectElementToBeVisible('detection-saved-offline-message');
    
    // Re-enable network
    await enableNetwork();
    
    // Verify online indicator is shown
    await waitFor(element(by.id('online-indicator')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show "Last updated" timestamps for all cached data', async () => {
    await waitForElement('home-screen');
    
    // Load data online first
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await device.pressBack();
    
    // Go offline
    await disableNetwork();
    
    // Check weather screen
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await expectElementToBeVisible('last-updated-text');
    
    const timestampText = await element(by.id('last-updated-text')).getAttributes();
    expect(timestampText.text).toMatch(/Last updated:/);
    expect(timestampText.text).toMatch(/\d{1,2}:\d{2}/); // Time format
    
    await device.pressBack();
    
    // Re-enable network
    await enableNetwork();
  });

  it('should display offline indicator when network is unavailable', async () => {
    await waitForElement('home-screen');
    
    // Disable network
    await disableNetwork();
    
    // Should show offline indicator
    await expectElementToBeVisible('offline-indicator');
    
    // Indicator should be visible on all screens
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await expectElementToBeVisible('offline-indicator');
    await device.pressBack();
    
    await tapButton('market-widget');
    await waitForElement('market-prices-screen', 5000);
    await expectElementToBeVisible('offline-indicator');
    await device.pressBack();
    
    // Re-enable network
    await enableNetwork();
    
    // Offline indicator should disappear
    await waitFor(element(by.id('offline-indicator')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('should queue actions when offline', async () => {
    await waitForElement('home-screen');
    
    // Disable network
    await disableNetwork();
    
    // Perform actions that require sync
    // 1. Update farm profile
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    
    await element(by.id('land-size-input')).clearText();
    await element(by.id('land-size-input')).typeText('3.5');
    await tapButton('save-farm-profile-button');
    
    // Should show queued message
    await expectElementToBeVisible('changes-queued-message');
    
    // 2. Save disease detection
    await device.pressBack();
    await device.pressBack();
    await waitForElement('home-screen');
    
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    await waitForElement('image-preview', 3000);
    await tapButton('confirm-image-button');
    
    await waitFor(element(by.id('disease-results')))
      .toBeVisible()
      .withTimeout(3000);
    
    await tapButton('save-detection-button');
    await expectElementToBeVisible('detection-saved-offline-message');
    
    // Check sync queue status
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Sync status should show pending items
    await expectElementToBeVisible('sync-status-indicator');
    const syncStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(syncStatus.text).toMatch(/\d+ pending/);
    
    // Re-enable network
    await enableNetwork();
  });

  it('should handle stale cache gracefully', async () => {
    await waitForElement('home-screen');
    
    // Simulate stale cache by going offline after data is loaded
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    await device.pressBack();
    
    // Go offline
    await disableNetwork();
    
    // Access cached data
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    
    // Should show cache age indicator
    await expectElementToBeVisible('cached-data-indicator');
    await expectElementToBeVisible('last-updated-text');
    
    // Should show refresh button (disabled while offline)
    await expectElementToBeVisible('refresh-button');
    
    // Re-enable network
    await enableNetwork();
    
    // Refresh button should become enabled
    await waitFor(element(by.id('refresh-button')))
      .toBeVisible()
      .withTimeout(3000);
    
    await tapButton('refresh-button');
    
    // Should fetch fresh data
    await waitFor(element(by.id('loading-indicator')))
      .toBeVisible()
      .withTimeout(1000);
    
    await waitFor(element(by.id('loading-indicator')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('should preserve user actions across app restarts when offline', async () => {
    await waitForElement('home-screen');
    
    // Go offline
    await disableNetwork();
    
    // Perform action
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    await waitForElement('image-preview', 3000);
    await tapButton('confirm-image-button');
    
    await waitFor(element(by.id('disease-results')))
      .toBeVisible()
      .withTimeout(3000);
    
    await tapButton('save-detection-button');
    
    // Restart app
    await device.terminateApp();
    await device.launchApp({ newInstance: false });
    
    await waitForElement('home-screen');
    
    // Sync queue should still have pending items
    await expectElementToBeVisible('sync-status-indicator');
    const syncStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(syncStatus.text).toMatch(/\d+ pending/);
    
    // Re-enable network
    await enableNetwork();
  });

  it('should show appropriate error messages when trying to access uncached data offline', async () => {
    // Clear app data to ensure no cache
    await device.terminateApp();
    await device.launchApp({
      newInstance: true,
      delete: true
    });
    
    await waitForElement('home-screen');
    
    // Go offline immediately
    await disableNetwork();
    
    // Try to access data that hasn't been cached
    await tapButton('weather-widget');
    await waitForElement('weather-forecast-screen', 5000);
    
    // Should show offline error message
    await expectElementToBeVisible('offline-no-cache-message');
    await expectElementToBeVisible('retry-when-online-text');
    
    // Re-enable network
    await enableNetwork();
  });
});
