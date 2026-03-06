import { device } from 'detox';

beforeAll(async () => {
  await device.launchApp({
    permissions: {
      location: 'always',
      camera: 'YES',
      microphone: 'YES'
    },
    newInstance: true
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await device.terminateApp();
});

// Helper functions for E2E tests
export const waitForElement = async (elementId: string, timeout = 10000) => {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .withTimeout(timeout);
};

export const typeText = async (elementId: string, text: string) => {
  await element(by.id(elementId)).tap();
  await element(by.id(elementId)).typeText(text);
};

export const tapButton = async (elementId: string) => {
  await element(by.id(elementId)).tap();
};

export const scrollToElement = async (scrollViewId: string, elementId: string) => {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(200, 'down');
};

export const expectElementToBeVisible = async (elementId: string) => {
  await expect(element(by.id(elementId))).toBeVisible();
};

export const expectElementToHaveText = async (elementId: string, text: string) => {
  await expect(element(by.id(elementId))).toHaveText(text);
};

export const disableNetwork = async () => {
  // Disable network connectivity
  await device.setURLBlacklist(['.*']);
};

export const enableNetwork = async () => {
  // Enable network connectivity
  await device.setURLBlacklist([]);
};

export const clearAppData = async () => {
  await device.clearKeychain();
  await device.launchApp({
    newInstance: true,
    delete: true
  });
};
