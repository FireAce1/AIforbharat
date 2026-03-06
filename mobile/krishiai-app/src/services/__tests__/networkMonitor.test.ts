/**
 * Tests for NetworkMonitor
 * 
 * Tests auto-sync on WiFi functionality including:
 * - Network state detection
 * - Auto-sync triggering on WiFi connection
 * - Sync progress tracking
 * - Manual sync functionality
 */

import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {NetworkMonitor, initializeNetworkMonitor, stopNetworkMonitor} from '../networkMonitor';
import {getSyncQueueManager} from '../syncQueueManager';
import {store} from '../../store/store';
import {setOnlineStatus, startSync, syncComplete, syncFailed} from '../../store/slices/syncSlice';

// Mock dependencies
jest.mock('@react-native-community/netinfo');
jest.mock('../syncQueueManager');
jest.mock('../../store/store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

describe('NetworkMonitor', () => {
  let networkMonitor: NetworkMonitor;
  let mockNetInfoListener: (state: NetInfoState) => void;
  let mockSyncManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock NetInfo.addEventListener
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockNetInfoListener = listener;
      return jest.fn(); // unsubscribe function
    });

    // Mock NetInfo.fetch
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      type: 'none',
      isInternetReachable: null,
    });

    // Mock sync queue manager
    mockSyncManager = {
      getPendingCount: jest.fn().mockResolvedValue(0),
      processQueue: jest.fn().mockResolvedValue([]),
    };
    (getSyncQueueManager as jest.Mock).mockReturnValue(mockSyncManager);

    // Initialize network monitor
    networkMonitor = new NetworkMonitor();
  });

  afterEach(() => {
    if (networkMonitor) {
      networkMonitor.stop();
    }
    stopNetworkMonitor();
  });

  describe('Network State Detection', () => {
    it('should detect WiFi connection', async () => {
      networkMonitor.start();

      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };

      await mockNetInfoListener(wifiState);

      expect(networkMonitor.isWiFiConnected()).toBe(true);
      expect(networkMonitor.isConnected()).toBe(true);
    });

    it('should detect cellular connection', async () => {
      networkMonitor.start();

      const cellularState: NetInfoState = {
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        details: null,
      };

      await mockNetInfoListener(cellularState);

      expect(networkMonitor.isWiFiConnected()).toBe(false);
      expect(networkMonitor.isConnected()).toBe(true);
    });

    it('should detect offline state', async () => {
      networkMonitor.start();

      const offlineState: NetInfoState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
        details: null,
      };

      await mockNetInfoListener(offlineState);

      expect(networkMonitor.isWiFiConnected()).toBe(false);
      expect(networkMonitor.isConnected()).toBe(false);
    });

    it('should update Redux state on network change', async () => {
      networkMonitor.start();

      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };

      await mockNetInfoListener(wifiState);

      expect(store.dispatch).toHaveBeenCalledWith(setOnlineStatus(true));
    });
  });

  describe('Auto-Sync on WiFi', () => {
    it('should trigger auto-sync when WiFi connects', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(5);
      mockSyncManager.processQueue.mockResolvedValue([
        {success: true, itemId: '1'},
        {success: true, itemId: '2'},
        {success: true, itemId: '3'},
        {success: true, itemId: '4'},
        {success: true, itemId: '5'},
      ]);

      networkMonitor.start();

      // Start offline
      const offlineState: NetInfoState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
        details: null,
      };
      await mockNetInfoListener(offlineState);

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSyncManager.getPendingCount).toHaveBeenCalled();
      expect(mockSyncManager.processQueue).toHaveBeenCalled();
      expect(store.dispatch).toHaveBeenCalledWith(startSync());
      expect(store.dispatch).toHaveBeenCalledWith(syncComplete());
    });

    it('should trigger auto-sync when switching from cellular to WiFi', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(3);
      mockSyncManager.processQueue.mockResolvedValue([
        {success: true, itemId: '1'},
        {success: true, itemId: '2'},
        {success: true, itemId: '3'},
      ]);

      networkMonitor.start();

      // Start on cellular
      const cellularState: NetInfoState = {
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(cellularState);

      // Switch to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSyncManager.processQueue).toHaveBeenCalled();
    });

    it('should NOT trigger auto-sync on cellular connection', async () => {
      networkMonitor.start();

      // Start offline
      const offlineState: NetInfoState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
        details: null,
      };
      await mockNetInfoListener(offlineState);

      // Connect to cellular
      const cellularState: NetInfoState = {
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(cellularState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSyncManager.processQueue).not.toHaveBeenCalled();
    });

    it('should NOT trigger auto-sync if no pending items', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(0);

      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSyncManager.getPendingCount).toHaveBeenCalled();
      expect(mockSyncManager.processQueue).not.toHaveBeenCalled();
    });

    it('should NOT trigger auto-sync if already syncing', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(5);
      mockSyncManager.processQueue.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve([]), 1000));
      });

      networkMonitor.start();

      // Connect to WiFi (first time)
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Immediately trigger again (should be ignored)
      await mockNetInfoListener(wifiState);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only be called once
      expect(mockSyncManager.processQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sync Progress Tracking', () => {
    it('should track sync progress via callback', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(3);
      mockSyncManager.processQueue.mockResolvedValue([
        {success: true, itemId: '1'},
        {success: true, itemId: '2'},
        {success: true, itemId: '3'},
      ]);

      const progressCallback = jest.fn();
      networkMonitor.setSyncProgressCallback(progressCallback);
      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(progressCallback).toHaveBeenCalledWith({
        itemsSynced: 3,
        itemsRemaining: 0,
        totalItems: 3,
      });
    });

    it('should handle sync failures', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(3);
      mockSyncManager.processQueue.mockResolvedValue([
        {success: true, itemId: '1'},
        {success: false, itemId: '2', error: 'Network error'},
        {success: true, itemId: '3'},
      ]);

      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSyncManager.processQueue).toHaveBeenCalled();
      expect(store.dispatch).toHaveBeenCalledWith(syncComplete());
    });

    it('should dispatch syncFailed on error', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(3);
      mockSyncManager.processQueue.mockRejectedValue(new Error('Sync failed'));

      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(store.dispatch).toHaveBeenCalledWith(syncFailed());
    });
  });

  describe('Manual Sync', () => {
    it('should allow manual sync when connected', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(2);
      mockSyncManager.processQueue.mockResolvedValue([
        {success: true, itemId: '1'},
        {success: true, itemId: '2'},
      ]);

      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Clear previous calls
      jest.clearAllMocks();

      // Trigger manual sync
      await networkMonitor.manualSync();

      expect(mockSyncManager.processQueue).toHaveBeenCalled();
    });

    it('should throw error when manual sync offline', async () => {
      networkMonitor.start();

      // Stay offline
      const offlineState: NetInfoState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
        details: null,
      };
      await mockNetInfoListener(offlineState);

      await expect(networkMonitor.manualSync()).rejects.toThrow('No internet connection');
    });

    it('should throw error when sync already in progress', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(5);
      mockSyncManager.processQueue.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve([]), 1000));
      });

      networkMonitor.start();

      // Connect to WiFi
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Try manual sync while auto-sync is running
      await expect(networkMonitor.manualSync()).rejects.toThrow('Sync already in progress');
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop monitoring', () => {
      networkMonitor.start();
      expect(NetInfo.addEventListener).toHaveBeenCalled();

      networkMonitor.stop();
      // Unsubscribe function should be called
    });

    it('should initialize singleton instance', () => {
      const instance1 = initializeNetworkMonitor();
      const instance2 = initializeNetworkMonitor();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Network State Queries', () => {
    it('should return current network state', async () => {
      networkMonitor.start();

      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      const state = networkMonitor.getNetworkState();
      expect(state.isConnected).toBe(true);
      expect(state.type).toBe('wifi');
      expect(state.isInternetReachable).toBe(true);
    });

    it('should report sync in progress status', async () => {
      mockSyncManager.getPendingCount.mockResolvedValue(5);
      mockSyncManager.processQueue.mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve([]), 500));
      });

      networkMonitor.start();

      expect(networkMonitor.isSyncInProgress()).toBe(false);

      // Connect to WiFi to trigger sync
      const wifiState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };
      await mockNetInfoListener(wifiState);

      // Wait a bit for sync to start
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(networkMonitor.isSyncInProgress()).toBe(true);

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(networkMonitor.isSyncInProgress()).toBe(false);
    });
  });
});
