import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  tapButton,
  expectElementToBeVisible,
  expectElementToHaveText
} from './setup';

describe('Disease Detection Flow', () => {
  beforeAll(async () => {
    // Assume user is already logged in
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'YES' }
    });
  });

  it('should complete disease detection: open camera → capture → view results → save', async () => {
    // Navigate to home screen
    await waitForElement('home-screen');
    
    // Step 1: Open disease detection screen
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    
    // Step 2: Open camera
    await expectElementToBeVisible('camera-button');
    await tapButton('camera-button');
    
    // Wait for camera to initialize
    await waitForElement('camera-view', 5000);
    await expectElementToBeVisible('capture-button');
    
    // Step 3: Capture image
    await tapButton('capture-button');
    
    // Wait for image preview
    await waitForElement('image-preview', 3000);
    await expectElementToBeVisible('confirm-image-button');
    await expectElementToBeVisible('retake-button');
    
    // Confirm image
    await tapButton('confirm-image-button');
    
    // Step 4: Wait for inference (should complete within 2 seconds)
    await waitForElement('inference-loading', 1000);
    await waitFor(element(by.id('disease-results')))
      .toBeVisible()
      .withTimeout(3000);
    
    // Step 5: View results
    await expectElementToBeVisible('disease-name-text');
    await expectElementToBeVisible('disease-scientific-name-text');
    await expectElementToBeVisible('confidence-score-text');
    await expectElementToBeVisible('severity-badge');
    await expectElementToBeVisible('treatment-recommendations');
    
    // Verify organic treatment is shown first
    await expectElementToBeVisible('organic-treatment-section');
    await expectElementToBeVisible('chemical-treatment-section');
    
    // Step 6: Save detection
    await tapButton('save-detection-button');
    
    // Should show success message
    await expectElementToBeVisible('detection-saved-message');
    
    // Should navigate back to home or history
    await waitForElement('home-screen', 5000);
  });

  it('should allow retaking photo if user is not satisfied', async () => {
    await waitForElement('home-screen');
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    
    await waitForElement('image-preview', 3000);
    
    // Retake photo
    await tapButton('retake-button');
    
    // Should return to camera view
    await expectElementToBeVisible('camera-view');
    await expectElementToBeVisible('capture-button');
  });

  it('should show confidence score as percentage', async () => {
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
    
    // Confidence score should be displayed as percentage (0-100%)
    const confidenceText = await element(by.id('confidence-score-text')).getAttributes();
    expect(confidenceText.text).toMatch(/\d+%/);
  });

  it('should display severity levels correctly', async () => {
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
    
    // Severity badge should show one of: Early, Moderate, Severe
    await expectElementToBeVisible('severity-badge');
    const severityText = await element(by.id('severity-badge')).getAttributes();
    expect(['Early', 'Moderate', 'Severe']).toContain(severityText.text);
  });

  it('should work completely offline', async () => {
    // Disable network
    await device.setURLBlacklist(['.*']);
    
    await waitForElement('home-screen');
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    
    await waitForElement('image-preview', 3000);
    await tapButton('confirm-image-button');
    
    // Should still complete inference offline
    await waitFor(element(by.id('disease-results')))
      .toBeVisible()
      .withTimeout(3000);
    
    await expectElementToBeVisible('disease-name-text');
    
    // Save should add to sync queue
    await tapButton('save-detection-button');
    await expectElementToBeVisible('detection-saved-offline-message');
    
    // Re-enable network
    await device.setURLBlacklist([]);
  });

  it('should handle camera permission denial gracefully', async () => {
    // Revoke camera permission
    await device.launchApp({
      newInstance: true,
      permissions: { camera: 'NO' }
    });
    
    await waitForElement('home-screen');
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    
    await tapButton('camera-button');
    
    // Should show permission error
    await expectElementToBeVisible('camera-permission-error');
    await expectElementToBeVisible('open-settings-button');
  });

  it('should show loading indicator during inference', async () => {
    await waitForElement('home-screen');
    await tapButton('disease-detection-button');
    await waitForElement('disease-detection-screen', 5000);
    
    await tapButton('camera-button');
    await waitForElement('camera-view', 5000);
    await tapButton('capture-button');
    
    await waitForElement('image-preview', 3000);
    await tapButton('confirm-image-button');
    
    // Should show loading indicator
    await expectElementToBeVisible('inference-loading');
    await expectElementToBeVisible('analyzing-text');
    
    // Loading should disappear when results are ready
    await waitFor(element(by.id('inference-loading')))
      .not.toBeVisible()
      .withTimeout(3000);
  });
});
