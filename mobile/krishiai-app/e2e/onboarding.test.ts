import { device, element, by, expect, waitFor } from 'detox';
import {
  waitForElement,
  typeText,
  tapButton,
  expectElementToBeVisible,
  clearAppData
} from './setup';

describe('Onboarding Flow', () => {
  beforeAll(async () => {
    await clearAppData();
  });

  it('should complete full onboarding flow: phone → OTP → language → farm profile → home', async () => {
    // Step 1: Phone Input Screen
    await waitForElement('phone-input-screen');
    await expectElementToBeVisible('phone-input-field');
    
    // Enter valid Indian phone number
    await typeText('phone-input-field', '9876543210');
    await expectElementToBeVisible('send-otp-button');
    await tapButton('send-otp-button');
    
    // Wait for OTP screen
    await waitForElement('otp-verification-screen', 15000);
    
    // Step 2: OTP Verification Screen
    await expectElementToBeVisible('otp-input-field');
    
    // Enter OTP (in test environment, use test OTP: 123456)
    await typeText('otp-input-field', '123456');
    await tapButton('verify-otp-button');
    
    // Wait for language selection screen
    await waitForElement('language-selection-screen', 10000);
    
    // Step 3: Language Selection Screen
    await expectElementToBeVisible('language-hindi-button');
    await expectElementToBeVisible('language-marathi-button');
    
    // Select Hindi
    await tapButton('language-hindi-button');
    
    // Wait for farm profile screen
    await waitForElement('farm-profile-screen', 10000);
    
    // Step 4: Farm Profile Screen
    await expectElementToBeVisible('farm-profile-form');
    
    // Enable location (simulated)
    await tapButton('enable-location-button');
    await device.setLocation(19.0760, 72.8777); // Mumbai coordinates
    
    // Wait for location to be detected
    await waitFor(element(by.id('location-detected-text')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Enter land size
    await typeText('land-size-input', '2.5');
    
    // Select soil type
    await tapButton('soil-type-dropdown');
    await tapButton('soil-type-black');
    
    // Select irrigation type
    await tapButton('irrigation-type-dropdown');
    await tapButton('irrigation-type-borewell');
    
    // Submit farm profile
    await tapButton('submit-farm-profile-button');
    
    // Step 5: Home Screen
    await waitForElement('home-screen', 10000);
    
    // Verify home screen elements
    await expectElementToBeVisible('weather-widget');
    await expectElementToBeVisible('market-widget');
    await expectElementToBeVisible('disease-detection-button');
    await expectElementToBeVisible('crop-recommendation-button');
    await expectElementToBeVisible('sync-status-indicator');
  });

  it('should show validation errors for invalid phone number', async () => {
    await clearAppData();
    await waitForElement('phone-input-screen');
    
    // Enter invalid phone number (too short)
    await typeText('phone-input-field', '12345');
    await tapButton('send-otp-button');
    
    // Should show error message
    await expectElementToBeVisible('phone-validation-error');
  });

  it('should allow OTP resend after 30 seconds', async () => {
    await clearAppData();
    await waitForElement('phone-input-screen');
    
    // Enter valid phone number
    await typeText('phone-input-field', '9876543210');
    await tapButton('send-otp-button');
    
    await waitForElement('otp-verification-screen', 15000);
    
    // Resend button should be disabled initially
    await expect(element(by.id('resend-otp-button'))).not.toBeVisible();
    
    // Wait for 30 seconds
    await waitFor(element(by.id('resend-otp-button')))
      .toBeVisible()
      .withTimeout(35000);
    
    // Tap resend button
    await tapButton('resend-otp-button');
    
    // Should show success message
    await expectElementToBeVisible('otp-resent-message');
  });

  it('should show error for invalid OTP', async () => {
    await clearAppData();
    await waitForElement('phone-input-screen');
    
    await typeText('phone-input-field', '9876543210');
    await tapButton('send-otp-button');
    
    await waitForElement('otp-verification-screen', 15000);
    
    // Enter invalid OTP
    await typeText('otp-input-field', '000000');
    await tapButton('verify-otp-button');
    
    // Should show error message
    await expectElementToBeVisible('otp-verification-error');
  });

  it('should support both hectares and acres for land size', async () => {
    await clearAppData();
    
    // Complete onboarding up to farm profile
    await waitForElement('phone-input-screen');
    await typeText('phone-input-field', '9876543210');
    await tapButton('send-otp-button');
    
    await waitForElement('otp-verification-screen', 15000);
    await typeText('otp-input-field', '123456');
    await tapButton('verify-otp-button');
    
    await waitForElement('language-selection-screen', 10000);
    await tapButton('language-hindi-button');
    
    await waitForElement('farm-profile-screen', 10000);
    
    // Enter land size in acres
    await typeText('land-size-input', '5');
    await tapButton('unit-toggle-button'); // Switch to acres
    
    // Should show converted value in hectares
    await expectElementToBeVisible('converted-land-size-text');
  });
});
