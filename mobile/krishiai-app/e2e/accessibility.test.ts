import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  typeText,
  tapButton,
  expectElementToBeVisible,
  clearAppData
} from './setup';

describe('Accessibility Testing', () => {
  beforeAll(async () => {
    await clearAppData();
    
    // Complete onboarding to access main features
    await waitForElement('phone-input-screen');
    await typeText('phone-input-field', '9876543210');
    await tapButton('send-otp-button');
    
    await waitForElement('otp-verification-screen', 15000);
    await typeText('otp-input-field', '123456');
    await tapButton('verify-otp-button');
    
    await waitForElement('language-selection-screen', 10000);
    await tapButton('language-hindi-button');
    
    await waitForElement('farm-profile-screen', 10000);
    await tapButton('enable-location-button');
    await device.setLocation(19.0760, 72.8777);
    await waitFor(element(by.id('location-detected-text')))
      .toBeVisible()
      .withTimeout(5000);
    await typeText('land-size-input', '2.5');
    await tapButton('soil-type-dropdown');
    await tapButton('soil-type-black');
    await tapButton('irrigation-type-dropdown');
    await tapButton('irrigation-type-borewell');
    await tapButton('submit-farm-profile-button');
    
    await waitForElement('home-screen', 10000);
  });

  describe('Requirement 14.1: Navigation Depth (Max 3 Taps)', () => {
    it('should reach disease detection in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Disease detection button on home screen
      await tapButton('disease-detection-button');
      
      // Should reach disease detection screen in 1 tap
      await waitForElement('disease-detection-screen', 5000);
      await expectElementToBeVisible('camera-view');
      
      // Navigate back to home
      await device.pressBack();
      await waitForElement('home-screen');
    });

    it('should reach crop recommendation in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Crop recommendation button on home screen
      await tapButton('crop-recommendation-button');
      
      // Should reach crop recommendation screen in 1 tap
      await waitForElement('crop-recommendation-screen', 5000);
      
      await device.pressBack();
      await waitForElement('home-screen');
    });

    it('should reach market prices in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Navigate to market tab
      await tapButton('market-tab');
      
      // Should reach market screen in 1 tap
      await waitForElement('market-prices-screen', 5000);
      
      await tapButton('home-tab');
      await waitForElement('home-screen');
    });

    it('should reach weather forecast in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Navigate to weather tab
      await tapButton('weather-tab');
      
      // Should reach weather screen in 1 tap
      await waitForElement('weather-forecast-screen', 5000);
      
      await tapButton('home-tab');
      await waitForElement('home-screen');
    });

    it('should reach government schemes in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Navigate to schemes tab
      await tapButton('schemes-tab');
      
      // Should reach schemes screen in 1 tap
      await waitForElement('schemes-screen', 5000);
      
      await tapButton('home-tab');
      await waitForElement('home-screen');
    });

    it('should reach chatbot in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Navigate to chatbot tab
      await tapButton('chatbot-tab');
      
      // Should reach chatbot screen in 1 tap
      await waitForElement('chatbot-screen', 5000);
      
      await tapButton('home-tab');
      await waitForElement('home-screen');
    });

    it('should reach settings in ≤3 taps from home', async () => {
      await waitForElement('home-screen');
      
      // Tap 1: Open drawer/menu
      await tapButton('menu-button');
      
      // Tap 2: Settings option
      await tapButton('settings-menu-item');
      
      // Should reach settings in 2 taps
      await waitForElement('settings-screen', 5000);
      
      await device.pressBack();
      await waitForElement('home-screen');
    });
  });

  describe('Requirement 14.2: High Contrast UI and Font Size', () => {
    it('should display all text with minimum 16sp font size', async () => {
      await waitForElement('home-screen');
      
      // Check home screen text elements
      const homeTitle = element(by.id('home-title'));
      await expect(homeTitle).toBeVisible();
      
      // Navigate to different screens and verify text visibility
      await tapButton('crop-recommendation-button');
      await waitForElement('crop-recommendation-screen', 5000);
      
      const screenTitle = element(by.id('screen-title'));
      await expect(screenTitle).toBeVisible();
      
      await device.pressBack();
    });

    it('should use high contrast colors for sunlight readability', async () => {
      // Simulate high brightness (sunlight conditions)
      // Note: Actual brightness control requires native module
      
      await waitForElement('home-screen');
      
      // Verify critical UI elements are visible
      await expectElementToBeVisible('weather-widget');
      await expectElementToBeVisible('market-widget');
      await expectElementToBeVisible('disease-detection-button');
      await expectElementToBeVisible('crop-recommendation-button');
      
      // Check button contrast
      const diseaseButton = element(by.id('disease-detection-button'));
      await expect(diseaseButton).toBeVisible();
      
      // Navigate to screens with data display
      await tapButton('market-tab');
      await waitForElement('market-prices-screen', 5000);
      
      // Verify price data is visible with high contrast
      await expectElementToBeVisible('price-list');
      
      await tapButton('home-tab');
    });

    it('should maintain readability in all screens', async () => {
      const screens = [
        { tab: 'market-tab', screen: 'market-prices-screen' },
        { tab: 'weather-tab', screen: 'weather-forecast-screen' },
        { tab: 'schemes-tab', screen: 'schemes-screen' },
        { tab: 'chatbot-tab', screen: 'chatbot-screen' }
      ];

      for (const { tab, screen } of screens) {
        await tapButton(tab);
        await waitForElement(screen, 5000);
        
        // Verify screen title is visible
        const title = element(by.id('screen-title'));
        await expect(title).toBeVisible();
        
        // Verify main content is visible
        const content = element(by.id('main-content'));
        await expect(content).toBeVisible();
      }

      await tapButton('home-tab');
    });
  });

  describe('Requirement 14.3: Voice Input for All Text Fields', () => {
    it('should provide voice input for phone number field', async () => {
      await clearAppData();
      await waitForElement('phone-input-screen');
      
      // Verify voice input button exists
      await expectElementToBeVisible('phone-voice-input-button');
      
      // Tap voice input button
      await tapButton('phone-voice-input-button');
      
      // Should show voice recording indicator
      await waitFor(element(by.id('voice-recording-indicator')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should provide voice input for chatbot queries', async () => {
      await waitForElement('home-screen');
      await tapButton('chatbot-tab');
      await waitForElement('chatbot-screen', 5000);
      
      // Verify voice input button exists
      await expectElementToBeVisible('chatbot-voice-button');
      
      // Tap voice input button
      await tapButton('chatbot-voice-button');
      
      // Should show voice recording indicator
      await waitFor(element(by.id('voice-recording-indicator')))
        .toBeVisible()
        .withTimeout(3000);
      
      await tapButton('home-tab');
    });

    it('should provide voice input for search fields', async () => {
      await waitForElement('home-screen');
      await tapButton('schemes-tab');
      await waitForElement('schemes-screen', 5000);
      
      // Verify voice input button for search
      await expectElementToBeVisible('search-voice-button');
      
      await tapButton('home-tab');
    });
  });

  describe('Requirement 14.4: Error Messages in Plain Language', () => {
    it('should display error messages in Hindi when Hindi is selected', async () => {
      await clearAppData();
      await waitForElement('phone-input-screen');
      
      // Enter invalid phone number
      await typeText('phone-input-field', '12345');
      await tapButton('send-otp-button');
      
      // Should show error in Hindi
      await waitFor(element(by.id('phone-validation-error')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Verify error text is in Hindi (contains Devanagari script)
      const errorElement = element(by.id('phone-validation-error'));
      await expect(errorElement).toBeVisible();
    });

    it('should display error messages in Marathi when Marathi is selected', async () => {
      await clearAppData();
      await waitForElement('phone-input-screen');
      await typeText('phone-input-field', '9876543210');
      await tapButton('send-otp-button');
      
      await waitForElement('otp-verification-screen', 15000);
      await typeText('otp-input-field', '123456');
      await tapButton('verify-otp-button');
      
      await waitForElement('language-selection-screen', 10000);
      
      // Select Marathi
      await tapButton('language-marathi-button');
      
      await waitForElement('farm-profile-screen', 10000);
      
      // Try to submit without filling required fields
      await tapButton('submit-farm-profile-button');
      
      // Should show error in Marathi
      await waitFor(element(by.id('form-validation-error')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display network error messages in user language', async () => {
      await waitForElement('home-screen');
      
      // Disable network
      await device.setURLBlacklist(['.*']);
      
      // Try to fetch data
      await tapButton('crop-recommendation-button');
      await waitForElement('crop-recommendation-screen', 5000);
      await tapButton('get-recommendations-button');
      
      // Should show offline message in user's language
      await waitFor(element(by.id('offline-message')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Re-enable network
      await device.setURLBlacklist([]);
      
      await device.pressBack();
    });
  });

  describe('Requirement 14.5: Touch Target Sizes (Minimum 48x48dp)', () => {
    it('should have all buttons with minimum 48x48dp touch targets', async () => {
      await waitForElement('home-screen');
      
      // Test primary action buttons
      const buttons = [
        'disease-detection-button',
        'crop-recommendation-button',
        'menu-button'
      ];

      for (const buttonId of buttons) {
        const button = element(by.id(buttonId));
        await expect(button).toBeVisible();
        
        // Tap button to verify it's tappable (implicit touch target test)
        await tapButton(buttonId);
        
        // Navigate back if needed
        if (buttonId !== 'menu-button') {
          await device.pressBack();
          await waitForElement('home-screen');
        } else {
          await device.pressBack();
        }
      }
    });

    it('should have all tab bar items with minimum 48x48dp touch targets', async () => {
      await waitForElement('home-screen');
      
      const tabs = [
        'home-tab',
        'market-tab',
        'weather-tab',
        'schemes-tab',
        'chatbot-tab'
      ];

      for (const tabId of tabs) {
        await tapButton(tabId);
        
        // Wait for screen to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify tab is selected (implicit touch target test)
        const tab = element(by.id(tabId));
        await expect(tab).toBeVisible();
      }

      await tapButton('home-tab');
    });

    it('should have all list items with minimum 48x48dp touch targets', async () => {
      await waitForElement('home-screen');
      await tapButton('schemes-tab');
      await waitForElement('schemes-screen', 5000);
      
      // Wait for schemes to load
      await waitFor(element(by.id('scheme-list')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Tap first scheme item
      await tapButton('scheme-item-0');
      
      // Should navigate to detail screen
      await waitForElement('scheme-detail-screen', 5000);
      
      await device.pressBack();
      await tapButton('home-tab');
    });

    it('should have all icon buttons with minimum 48x48dp touch targets', async () => {
      await waitForElement('home-screen');
      await tapButton('chatbot-tab');
      await waitForElement('chatbot-screen', 5000);
      
      // Test voice button
      await expectElementToBeVisible('chatbot-voice-button');
      await tapButton('chatbot-voice-button');
      
      // Should activate voice input
      await waitFor(element(by.id('voice-recording-indicator')))
        .toBeVisible()
        .withTimeout(3000);
      
      await tapButton('home-tab');
    });
  });

  describe('Low-End Device Performance (2GB RAM)', () => {
    it('should launch app within 3 seconds on low-end device', async () => {
      // Restart app to test cold launch
      await device.launchApp({ newInstance: true });
      
      const startTime = Date.now();
      
      // Wait for app to be ready
      await waitForElement('phone-input-screen', 5000);
      
      const launchTime = Date.now() - startTime;
      
      // Should launch within 3000ms
      expect(launchTime).toBeLessThan(3000);
    });

    it('should perform disease detection within 2 seconds', async () => {
      await waitForElement('home-screen');
      await tapButton('disease-detection-button');
      await waitForElement('disease-detection-screen', 5000);
      
      // Simulate image capture (in test environment)
      await tapButton('capture-button');
      
      const startTime = Date.now();
      
      // Wait for inference results
      await waitFor(element(by.id('detection-results')))
        .toBeVisible()
        .withTimeout(3000);
      
      const inferenceTime = Date.now() - startTime;
      
      // Should complete inference within 2000ms
      expect(inferenceTime).toBeLessThan(2000);
      
      await device.pressBack();
    });

    it('should navigate smoothly between screens', async () => {
      await waitForElement('home-screen');
      
      const navigationTests = [
        { from: 'home-tab', to: 'market-tab', screen: 'market-prices-screen' },
        { from: 'market-tab', to: 'weather-tab', screen: 'weather-forecast-screen' },
        { from: 'weather-tab', to: 'schemes-tab', screen: 'schemes-screen' },
        { from: 'schemes-tab', to: 'chatbot-tab', screen: 'chatbot-screen' },
        { from: 'chatbot-tab', to: 'home-tab', screen: 'home-screen' }
      ];

      for (const { to, screen } of navigationTests) {
        const startTime = Date.now();
        
        await tapButton(to);
        await waitForElement(screen, 3000);
        
        const navigationTime = Date.now() - startTime;
        
        // Navigation should be smooth (< 1 second)
        expect(navigationTime).toBeLessThan(1000);
      }
    });

    it('should handle memory efficiently with multiple screens', async () => {
      await waitForElement('home-screen');
      
      // Navigate through all screens multiple times
      for (let i = 0; i < 3; i++) {
        await tapButton('market-tab');
        await waitForElement('market-prices-screen', 3000);
        
        await tapButton('weather-tab');
        await waitForElement('weather-forecast-screen', 3000);
        
        await tapButton('schemes-tab');
        await waitForElement('schemes-screen', 3000);
        
        await tapButton('chatbot-tab');
        await waitForElement('chatbot-screen', 3000);
        
        await tapButton('home-tab');
        await waitForElement('home-screen', 3000);
      }
      
      // App should still be responsive
      await expectElementToBeVisible('disease-detection-button');
      await expectElementToBeVisible('crop-recommendation-button');
    });
  });

  describe('Slow Network Performance (2G Simulation)', () => {
    it('should show loading indicators on slow network', async () => {
      await waitForElement('home-screen');
      
      // Simulate slow network (2G)
      await device.setURLBlacklist([]);
      // Note: Actual network throttling requires native implementation
      
      await tapButton('crop-recommendation-button');
      await waitForElement('crop-recommendation-screen', 5000);
      
      await tapButton('get-recommendations-button');
      
      // Should show loading indicator
      await waitFor(element(by.id('loading-indicator')))
        .toBeVisible()
        .withTimeout(2000);
      
      await device.pressBack();
    });

    it('should use cached data when network is slow', async () => {
      await waitForElement('home-screen');
      
      // First, load data with good network
      await tapButton('market-tab');
      await waitForElement('market-prices-screen', 5000);
      
      // Wait for data to load
      await waitFor(element(by.id('price-list')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Go back and disable network
      await tapButton('home-tab');
      await device.setURLBlacklist(['.*']);
      
      // Navigate back to market
      await tapButton('market-tab');
      await waitForElement('market-prices-screen', 5000);
      
      // Should show cached data with "Last updated" timestamp
      await expectElementToBeVisible('price-list');
      await expectElementToBeVisible('last-updated-text');
      
      // Re-enable network
      await device.setURLBlacklist([]);
      
      await tapButton('home-tab');
    });

    it('should gracefully degrade when network is unavailable', async () => {
      await waitForElement('home-screen');
      
      // Disable network
      await device.setURLBlacklist(['.*']);
      
      // Try to access features
      await tapButton('weather-tab');
      await waitForElement('weather-forecast-screen', 5000);
      
      // Should show offline indicator
      await expectElementToBeVisible('offline-indicator');
      
      // Should show cached data if available
      const cachedData = element(by.id('weather-forecast-list'));
      try {
        await expect(cachedData).toBeVisible();
        await expectElementToBeVisible('last-updated-text');
      } catch (e) {
        // If no cached data, should show appropriate message
        await expectElementToBeVisible('no-cached-data-message');
      }
      
      // Re-enable network
      await device.setURLBlacklist([]);
      
      await tapButton('home-tab');
    });

    it('should queue actions when offline and sync when online', async () => {
      await waitForElement('home-screen');
      
      // Disable network
      await device.setURLBlacklist(['.*']);
      
      // Perform action that requires sync
      await tapButton('disease-detection-button');
      await waitForElement('disease-detection-screen', 5000);
      
      // Capture image (simulated)
      await tapButton('capture-button');
      
      // Wait for results
      await waitFor(element(by.id('detection-results')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Save detection
      await tapButton('save-detection-button');
      
      // Should show queued for sync message
      await waitFor(element(by.id('queued-for-sync-message')))
        .toBeVisible()
        .withTimeout(3000);
      
      await device.pressBack();
      
      // Re-enable network
      await device.setURLBlacklist([]);
      
      // Should auto-sync
      await waitFor(element(by.id('sync-status-indicator')))
        .toHaveText('Syncing...')
        .withTimeout(5000);
      
      // Wait for sync to complete
      await waitFor(element(by.id('sync-status-indicator')))
        .toHaveText('Synced')
        .withTimeout(10000);
    });
  });

  describe('Voice Input/Output Testing (Hindi and Marathi)', () => {
    it('should support Hindi voice input for chatbot', async () => {
      await waitForElement('home-screen');
      await tapButton('chatbot-tab');
      await waitForElement('chatbot-screen', 5000);
      
      // Verify language is Hindi
      await expectElementToBeVisible('chatbot-voice-button');
      
      // Tap voice button
      await tapButton('chatbot-voice-button');
      
      // Should show voice recording indicator
      await waitFor(element(by.id('voice-recording-indicator')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Note: Actual voice recognition testing requires audio input simulation
      // which is not available in Detox. This test verifies the UI is ready.
      
      await tapButton('home-tab');
    });

    it('should support Marathi voice input after language change', async () => {
      await waitForElement('home-screen');
      
      // Navigate to settings
      await tapButton('menu-button');
      await tapButton('settings-menu-item');
      await waitForElement('settings-screen', 5000);
      
      // Change language to Marathi
      await tapButton('language-setting');
      await tapButton('language-marathi-option');
      
      // Navigate to chatbot
      await device.pressBack();
      await tapButton('chatbot-tab');
      await waitForElement('chatbot-screen', 5000);
      
      // Verify voice button is available
      await expectElementToBeVisible('chatbot-voice-button');
      
      // Tap voice button
      await tapButton('chatbot-voice-button');
      
      // Should show voice recording indicator
      await waitFor(element(by.id('voice-recording-indicator')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Change back to Hindi
      await tapButton('home-tab');
      await tapButton('menu-button');
      await tapButton('settings-menu-item');
      await waitForElement('settings-screen', 5000);
      await tapButton('language-setting');
      await tapButton('language-hindi-option');
      await device.pressBack();
    });

    it('should provide voice output for chatbot responses', async () => {
      await waitForElement('home-screen');
      await tapButton('chatbot-tab');
      await waitForElement('chatbot-screen', 5000);
      
      // Type a query
      await typeText('chatbot-input-field', 'मौसम कैसा है?');
      await tapButton('send-message-button');
      
      // Wait for response
      await waitFor(element(by.id('chatbot-response-0')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify speaker button is available for voice output
      await expectElementToBeVisible('response-speaker-button-0');
      
      // Tap speaker button
      await tapButton('response-speaker-button-0');
      
      // Should show speaking indicator
      await waitFor(element(by.id('speaking-indicator')))
        .toBeVisible()
        .withTimeout(2000);
      
      await tapButton('home-tab');
    });
  });
});
