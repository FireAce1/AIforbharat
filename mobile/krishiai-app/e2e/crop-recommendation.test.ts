import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  tapButton,
  expectElementToBeVisible,
  scrollToElement
} from './setup';

describe('Crop Recommendation Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should complete crop recommendation: request → view results → select crop', async () => {
    // Navigate to home screen
    await waitForElement('home-screen');
    
    // Step 1: Request crop recommendations
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await expectElementToBeVisible('get-recommendations-button');
    await tapButton('get-recommendations-button');
    
    // Step 2: Show loading state
    await expectElementToBeVisible('loading-indicator');
    await expectElementToBeVisible('analyzing-text');
    
    // Step 3: Wait for results (should complete within 500ms + network time)
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Step 4: View top 3 recommendations
    await expectElementToBeVisible('recommendation-card-1');
    await expectElementToBeVisible('recommendation-card-2');
    await expectElementToBeVisible('recommendation-card-3');
    
    // Verify ranking badges
    await expectElementToBeVisible('rank-badge-1');
    await expectElementToBeVisible('rank-badge-2');
    await expectElementToBeVisible('rank-badge-3');
    
    // Verify confidence scores are displayed
    await expectElementToBeVisible('confidence-bar-1');
    await expectElementToBeVisible('confidence-bar-2');
    await expectElementToBeVisible('confidence-bar-3');
    
    // Step 5: Tap on first recommendation to view details
    await tapButton('recommendation-card-1');
    await waitForElement('crop-detail-screen', 3000);
    
    // Verify all detail fields are present
    await expectElementToBeVisible('crop-name-text');
    await expectElementToBeVisible('expected-yield-text');
    await expectElementToBeVisible('investment-required-text');
    await expectElementToBeVisible('expected-revenue-text');
    await expectElementToBeVisible('profit-text');
    await expectElementToBeVisible('water-requirements-text');
    await expectElementToBeVisible('sowing-window-text');
    await expectElementToBeVisible('risk-level-badge');
    
    // Step 6: Select this crop
    await scrollToElement('crop-detail-scroll', 'select-crop-button');
    await tapButton('select-crop-button');
    
    // Should show confirmation
    await expectElementToBeVisible('crop-selected-message');
    
    // Should navigate back to home
    await waitForElement('home-screen', 5000);
  });

  it('should display confidence scores as progress bars (0-100%)', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Check confidence bars are visible and have valid percentages
    const confidence1 = await element(by.id('confidence-bar-1')).getAttributes();
    expect(confidence1).toBeDefined();
    
    // Confidence text should show percentage
    await expectElementToBeVisible('confidence-text-1');
    const confidenceText = await element(by.id('confidence-text-1')).getAttributes();
    expect(confidenceText.text).toMatch(/\d+%/);
  });

  it('should show risk levels correctly', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    await tapButton('recommendation-card-1');
    await waitForElement('crop-detail-screen', 3000);
    
    // Risk level should be one of: Low, Medium, High
    await expectElementToBeVisible('risk-level-badge');
    const riskText = await element(by.id('risk-level-badge')).getAttributes();
    expect(['Low', 'Medium', 'High']).toContain(riskText.text);
  });

  it('should cache recommendations for 24 hours', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Go back to home
    await device.pressBack();
    await waitForElement('home-screen');
    
    // Disable network
    await device.setURLBlacklist(['.*']);
    
    // Request recommendations again
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    // Should show cached results immediately
    await expectElementToBeVisible('recommendation-results');
    await expectElementToBeVisible('cached-data-indicator');
    await expectElementToBeVisible('last-updated-text');
    
    // Re-enable network
    await device.setURLBlacklist([]);
  });

  it('should show "Last updated" timestamp for cached data', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Go back and return
    await device.pressBack();
    await waitForElement('home-screen');
    
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    // Should show last updated timestamp
    await expectElementToBeVisible('last-updated-text');
    const timestampText = await element(by.id('last-updated-text')).getAttributes();
    expect(timestampText.text).toMatch(/Last updated:/);
  });

  it('should handle API errors gracefully', async () => {
    // Simulate API error by blocking network
    await device.setURLBlacklist(['.*']);
    
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    // Should show error message
    await waitFor(element(by.id('error-message')))
      .toBeVisible()
      .withTimeout(5000);
    
    await expectElementToBeVisible('retry-button');
    
    // Re-enable network
    await device.setURLBlacklist([]);
  });

  it('should display all financial metrics correctly', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    await tapButton('recommendation-card-1');
    await waitForElement('crop-detail-screen', 3000);
    
    // Verify financial metrics are displayed with rupee symbol
    const investment = await element(by.id('investment-required-text')).getAttributes();
    expect(investment.text).toMatch(/₹/);
    
    const revenue = await element(by.id('expected-revenue-text')).getAttributes();
    expect(revenue.text).toMatch(/₹/);
    
    const profit = await element(by.id('profit-text')).getAttributes();
    expect(profit.text).toMatch(/₹/);
  });

  it('should allow navigation between recommendation cards', async () => {
    await waitForElement('home-screen');
    await tapButton('crop-recommendation-button');
    await waitForElement('crop-recommendation-screen', 5000);
    
    await tapButton('get-recommendations-button');
    
    await waitFor(element(by.id('recommendation-results')))
      .toBeVisible()
      .withTimeout(5000);
    
    // View first recommendation
    await tapButton('recommendation-card-1');
    await waitForElement('crop-detail-screen', 3000);
    
    // Go back
    await device.pressBack();
    await expectElementToBeVisible('recommendation-results');
    
    // View second recommendation
    await tapButton('recommendation-card-2');
    await waitForElement('crop-detail-screen', 3000);
    
    // Go back
    await device.pressBack();
    await expectElementToBeVisible('recommendation-results');
    
    // View third recommendation
    await tapButton('recommendation-card-3');
    await waitForElement('crop-detail-screen', 3000);
  });
});
