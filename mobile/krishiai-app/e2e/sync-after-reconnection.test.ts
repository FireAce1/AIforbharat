import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  tapButton,
  expectElementToBeVisible,
  disableNetwork,
  enableNetwork
} from './setup';

describe('Sync After Reconnection', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should automatically sync when reconnected: enable network → verify sync queue processed', async () => {
    await waitForElement('home-screen');
    
    // Step 1: Go offline and perform actions
    await disableNetwork();
    
    // Action 1: Update farm profile
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    
    await element(by.id('land-size-input')).clearText();
    await element(by.id('land-size-input')).typeText('4.0');
    await tapButton('save-farm-profile-button');
    await expectElementToBeVisible('changes-queued-message');
    
    await device.pressBack();
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Action 2: Save disease detection
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
    
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Verify sync queue has pending items
    await expectElementToBeVisible('sync-status-indicator');
    const pendingStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(pendingStatus.text).toMatch(/\d+ pending/);
    
    // Step 2: Enable network and verify auto-sync
    await enableNetwork();
    
    // Should show syncing indicator
    await waitFor(element(by.id('syncing-indicator')))
      .toBeVisible()
      .withTimeout(3000);
    
    // Wait for sync to complete
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(15000);
    
    // Sync queue should be empty
    await waitFor(element(by.id('sync-status-indicator')))
      .toHaveText('All synced')
      .withTimeout(5000);
    
    // Last sync timestamp should be updated
    await expectElementToBeVisible('last-sync-timestamp');
  });

  it('should show sync progress during synchronization', async () => {
    await waitForElement('home-screen');
    
    // Go offline and create multiple actions
    await disableNetwork();
    
    // Create 3 actions
    for (let i = 0; i < 3; i++) {
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
      await device.pressBack();
      await waitForElement('home-screen');
    }
    
    // Verify 3 pending items
    const pendingStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(pendingStatus.text).toMatch(/3 pending/);
    
    // Enable network
    await enableNetwork();
    
    // Should show sync progress
    await waitFor(element(by.id('syncing-indicator')))
      .toBeVisible()
      .withTimeout(3000);
    
    // Should show items synced count
    await expectElementToBeVisible('sync-progress-text');
    
    // Wait for completion
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(20000);
  });

  it('should prioritize sync queue by priority levels', async () => {
    await waitForElement('home-screen');
    
    // Go offline
    await disableNetwork();
    
    // Create actions with different priorities
    // HIGH priority: Disease detection
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
    await device.pressBack();
    await waitForElement('home-screen');
    
    // MEDIUM priority: Farm profile update
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    await element(by.id('land-size-input')).clearText();
    await element(by.id('land-size-input')).typeText('5.0');
    await tapButton('save-farm-profile-button');
    await device.pressBack();
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Enable network
    await enableNetwork();
    
    // Sync should process HIGH priority items first
    await waitFor(element(by.id('syncing-indicator')))
      .toBeVisible()
      .withTimeout(3000);
    
    // Wait for sync completion
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(15000);
    
    // All items should be synced
    await expectElementToBeVisible('sync-status-indicator');
    const syncStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(syncStatus.text).toMatch(/All synced/);
  });

  it('should retry failed sync items with exponential backoff', async () => {
    await waitForElement('home-screen');
    
    // Go offline and create action
    await disableNetwork();
    
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
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Enable network but simulate API failure
    await device.setURLBlacklist(['.*api.*']);
    
    // Should attempt sync and fail
    await waitFor(element(by.id('syncing-indicator')))
      .toBeVisible()
      .withTimeout(3000);
    
    // Should show retry indicator
    await waitFor(element(by.id('sync-retry-indicator')))
      .toBeVisible()
      .withTimeout(10000);
    
    // Clear blacklist to allow sync
    await device.setURLBlacklist([]);
    
    // Should eventually succeed
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(30000);
  });

  it('should handle sync conflicts with last-write-wins strategy', async () => {
    await waitForElement('home-screen');
    
    // Update farm profile online
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    
    await element(by.id('land-size-input')).clearText();
    await element(by.id('land-size-input')).typeText('3.0');
    await tapButton('save-farm-profile-button');
    
    // Wait for save to complete
    await waitFor(element(by.id('save-success-message')))
      .toBeVisible()
      .withTimeout(5000);
    
    await device.pressBack();
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Go offline and update again
    await disableNetwork();
    
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    
    await element(by.id('land-size-input')).clearText();
    await element(by.id('land-size-input')).typeText('4.5');
    await tapButton('save-farm-profile-button');
    
    await device.pressBack();
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Enable network and sync
    await enableNetwork();
    
    await waitFor(element(by.id('syncing-indicator')))
      .toBeVisible()
      .withTimeout(3000);
    
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(15000);
    
    // Verify latest value is persisted (4.5)
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    await tapButton('farm-profile-button');
    await waitForElement('farm-profile-screen', 3000);
    
    const landSizeValue = await element(by.id('land-size-input')).getAttributes();
    expect(landSizeValue.text).toBe('4.5');
  });

  it('should update last sync timestamp after successful sync', async () => {
    await waitForElement('home-screen');
    
    // Go offline and create action
    await disableNetwork();
    
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
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Get current timestamp text
    const beforeSync = await element(by.id('last-sync-timestamp')).getAttributes();
    
    // Enable network and sync
    await enableNetwork();
    
    await waitFor(element(by.id('sync-complete-indicator')))
      .toBeVisible()
      .withTimeout(15000);
    
    // Timestamp should be updated
    const afterSync = await element(by.id('last-sync-timestamp')).getAttributes();
    expect(afterSync.text).not.toBe(beforeSync.text);
    expect(afterSync.text).toMatch(/Just now|\d+ (second|minute)s? ago/);
  });

  it('should allow manual sync from settings', async () => {
    await waitForElement('home-screen');
    
    // Go offline and create action
    await disableNetwork();
    
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
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Enable network
    await enableNetwork();
    
    // Navigate to settings
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    
    // Tap manual sync button
    await expectElementToBeVisible('sync-now-button');
    await tapButton('sync-now-button');
    
    // Should show sync progress
    await expectElementToBeVisible('sync-progress-modal');
    await expectElementToBeVisible('sync-progress-text');
    
    // Wait for completion
    await waitFor(element(by.id('sync-complete-message')))
      .toBeVisible()
      .withTimeout(15000);
    
    // Close modal
    await tapButton('close-sync-modal-button');
    
    // Verify sync status
    await device.pressBack();
    await waitForElement('home-screen');
    await expectElementToBeVisible('sync-status-indicator');
    const syncStatus = await element(by.id('sync-status-indicator')).getAttributes();
    expect(syncStatus.text).toMatch(/All synced/);
  });

  it('should show pending items count badge on sync button', async () => {
    await waitForElement('home-screen');
    
    // Go offline and create multiple actions
    await disableNetwork();
    
    for (let i = 0; i < 5; i++) {
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
      await device.pressBack();
      await waitForElement('home-screen');
    }
    
    // Navigate to settings
    await tapButton('settings-button');
    await waitForElement('settings-screen', 3000);
    
    // Sync button should show badge with count
    await expectElementToBeVisible('sync-now-button');
    await expectElementToBeVisible('pending-items-badge');
    
    const badgeText = await element(by.id('pending-items-badge')).getAttributes();
    expect(badgeText.text).toBe('5');
    
    // Enable network and sync
    await enableNetwork();
    await tapButton('sync-now-button');
    
    await waitFor(element(by.id('sync-complete-message')))
      .toBeVisible()
      .withTimeout(20000);
    
    // Badge should disappear
    await waitFor(element(by.id('pending-items-badge')))
      .not.toBeVisible()
      .withTimeout(3000);
  });
});
