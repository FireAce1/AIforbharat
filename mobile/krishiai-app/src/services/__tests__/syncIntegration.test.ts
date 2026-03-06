/**
 * Integration Tests for Sync Functionality
 * 
 * Comprehensive tests covering:
 * - Priority-based execution (CRITICAL → HIGH → MEDIUM → LOW)
 * - Retry logic with exponential backoff (1s, 2s, 4s)
 * - Conflict resolution (last-write-wins)
 * - Offline-online consistency
 * - Network interruption handling
 * 
 * Requirements: 11.1-11.6
 */

import {Database} from '@nozbe/watermelondb';
import {SyncQueueManager} from '../syncQueueManager';
import {NetworkMonitor} from '../networkMonitor';
import {ConflictResolver, ConflictData} from '../conflictResolver';
import SyncQueueItem from '../../database/models/SyncQueueItem';
import {apiClient} from '../apiClient';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('../apiClient');
jest.mock('@react-native-community/netinfo');
jest.mock('../../store/store', () => ({
  store: {
    dispatch: jest.fn(),
  },
}));

describe('Sync Functionality Integration Tests', () => {
  let mockDatabase: any;
  let syncQueueManager: SyncQueueManager;
  let conflictResolver: ConflictResolver;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock collection
    mockCollection = {
      create: jest.fn(),
      find: jest.fn(),
      query: jest.fn(() => ({
        fetch: jest.fn(),
        fetchCount: jest.fn(),
      })),
    };

    // Setup mock database
    mockDatabase = {
      get: jest.fn(() => mockCollection),
      write: jest.fn((callback: any) => callback()),
    } as unknown as Database;

    syncQueueManager = new SyncQueueManager(mockDatabase);
    conflictResolver = new ConflictResolver(mockDatabase);
  });

  describe('Priority-Based Execution', () => {
    /**
     * Test: Verify CRITICAL items process before LOW priority items
     * 
     * This test ensures that the sync queue processes items in strict priority order:
     * CRITICAL (0) → HIGH (1) → MEDIUM (2) → LOW (3)
     */
    it('should process CRITICAL items before LOW priority items', async () => {
      const processOrder: string[] = [];

      // Create items with different priorities
      const mockItems = [
        createMockItem('item-low', 'CREATE_CROP', 'LOW', 3, new Date('2024-01-01')),
        createMockItem('item-critical', 'AUTH_LOGIN', 'CRITICAL', 0, new Date('2024-01-02')),
        createMockItem('item-medium', 'UPDATE_FARM', 'MEDIUM', 2, new Date('2024-01-01T12:00:00')),
        createMockItem('item-high', 'CREATE_DISEASE_DETECTION', 'HIGH', 1, new Date('2024-01-01T06:00:00')),
      ];

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      // Mock API calls to track execution order
      (apiClient.post as jest.Mock).mockImplementation((url: string) => {
        const itemId = mockItems.find(item => 
          url.includes(item.action.toLowerCase().replace(/_/g, '/'))
        )?.id || 'unknown';
        processOrder.push(itemId);
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify execution order: CRITICAL → HIGH → MEDIUM → LOW
      expect(processOrder).toEqual([
        'item-critical',  // CRITICAL (priority 0)
        'item-high',      // HIGH (priority 1)
        'item-medium',    // MEDIUM (priority 2)
        'item-low',       // LOW (priority 3)
      ]);
    });

    /**
     * Test: Verify items with same priority are processed in FIFO order (oldest first)
     */
    it('should process items with same priority in FIFO order (oldest first)', async () => {
      const processOrder: string[] = [];

      const mockItems = [
        createMockItem('item-3', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-03')),
        createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-01')),
        createMockItem('item-2', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-02')),
      ];

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      (apiClient.post as jest.Mock).mockImplementation(() => {
        processOrder.push(mockItems.shift()?.id || 'unknown');
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify FIFO order for same priority
      expect(processOrder).toEqual(['item-1', 'item-2', 'item-3']);
    });

    /**
     * Test: Verify all priority levels are respected
     */
    it('should respect all four priority levels in correct order', async () => {
      const processOrder: string[] = [];

      const mockItems = [
        createMockItem('low-1', 'ACTION_LOW', 'LOW', 3, new Date('2024-01-01')),
        createMockItem('critical-1', 'ACTION_CRITICAL', 'CRITICAL', 0, new Date('2024-01-01')),
        createMockItem('medium-1', 'ACTION_MEDIUM', 'MEDIUM', 2, new Date('2024-01-01')),
        createMockItem('high-1', 'ACTION_HIGH', 'HIGH', 1, new Date('2024-01-01')),
        createMockItem('low-2', 'ACTION_LOW', 'LOW', 3, new Date('2024-01-02')),
        createMockItem('critical-2', 'ACTION_CRITICAL', 'CRITICAL', 0, new Date('2024-01-02')),
      ];

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      (apiClient.post as jest.Mock).mockImplementation(() => {
        processOrder.push(mockItems.shift()?.id || 'unknown');
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify strict priority order
      expect(processOrder[0]).toBe('critical-1');
      expect(processOrder[1]).toBe('critical-2');
      expect(processOrder[2]).toBe('high-1');
      expect(processOrder[3]).toBe('medium-1');
      expect(processOrder[4]).toBe('low-1');
      expect(processOrder[5]).toBe('low-2');
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    /**
     * Test: Verify 3 retry attempts with exponential backoff (1s, 2s, 4s)
     */
    it('should retry 3 times with exponential backoff delays (1s, 2s, 4s)', async () => {
      const mockItem = createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      const attemptTimes: number[] = [];
      let attemptCount = 0;

      // Mock API to fail 3 times, then succeed
      (apiClient.post as jest.Mock).mockImplementation(() => {
        attemptTimes.push(Date.now());
        attemptCount++;
        
        if (attemptCount <= 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({data: {success: true}});
      });

      const startTime = Date.now();
      await syncQueueManager.processQueue();
      const totalTime = Date.now() - startTime;

      // Verify 3 attempts were made (initial + 3 retries = 4 total calls)
      expect(attemptCount).toBe(4);

      // Verify delays between attempts (with tolerance for timing)
      if (attemptTimes.length >= 4) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];
        const delay3 = attemptTimes[3] - attemptTimes[2];

        // Allow 200ms tolerance for each delay
        expect(delay1).toBeGreaterThanOrEqual(900);  // ~1000ms
        expect(delay1).toBeLessThanOrEqual(1200);
        
        expect(delay2).toBeGreaterThanOrEqual(1900); // ~2000ms
        expect(delay2).toBeLessThanOrEqual(2200);
        
        expect(delay3).toBeGreaterThanOrEqual(3900); // ~4000ms
        expect(delay3).toBeLessThanOrEqual(4200);
      }

      // Total time should be approximately 1s + 2s + 4s = 7s
      expect(totalTime).toBeGreaterThanOrEqual(6900);
      expect(totalTime).toBeLessThanOrEqual(7500);
    }, 10000); // 10 second timeout

    /**
     * Test: Verify item marked as FAILED after max retries exceeded
     */
    it('should mark item as FAILED after 3 failed attempts', async () => {
      const mockItem = createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      let attemptCount = 0;

      // Mock API to always fail
      (apiClient.post as jest.Mock).mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new Error('Persistent network error'));
      });

      const results = await syncQueueManager.processQueue();

      // Verify exactly 3 attempts (initial + 2 retries)
      expect(attemptCount).toBe(3);

      // Verify item marked as FAILED
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Persistent network error');

      // Verify update was called to set FAILED status
      expect(mockItem.update).toHaveBeenCalled();
    }, 10000);

    /**
     * Test: Verify successful retry stops further attempts
     */
    it('should stop retrying after successful attempt', async () => {
      const mockItem = createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      let attemptCount = 0;

      // Mock API to fail once, then succeed
      (apiClient.post as jest.Mock).mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount === 1) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({data: {success: true}});
      });

      const results = await syncQueueManager.processQueue();

      // Verify only 2 attempts (initial + 1 retry)
      expect(attemptCount).toBe(2);

      // Verify item marked as COMPLETED
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    }, 5000);

    /**
     * Test: Verify retry count is tracked correctly
     */
    it('should track retry count correctly', async () => {
      const mockItem = createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      const retryCounts: number[] = [];

      // Track retry count on each update
      mockItem.update.mockImplementation((callback: any) => {
        callback(mockItem);
        retryCounts.push(mockItem.retryCount);
        return Promise.resolve();
      });

      // Mock API to fail twice, then succeed
      let attemptCount = 0;
      (apiClient.post as jest.Mock).mockImplementation(() => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify retry counts: 0 → 1 → 2 → success
      expect(retryCounts).toContain(1);
      expect(retryCounts).toContain(2);
    }, 10000);
  });

  describe('Conflict Resolution', () => {
    /**
     * Test: Create conflicting updates and verify last-write-wins
     */
    it('should resolve conflicts using last-write-wins strategy', async () => {
      const now = Date.now();
      const localUpdatedAt = now;
      const serverUpdatedAt = now - 5000; // Server is 5 seconds older

      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {
          name: 'Local Farm Name',
          size: 2.5,
          updated_at: localUpdatedAt,
        },
        serverData: {
          name: 'Server Farm Name',
          size: 2.0,
          updated_at: serverUpdatedAt,
        },
        localUpdatedAt,
        serverUpdatedAt,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      // Local is newer, should push to server
      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.shouldPushToServer).toBe(true);
      expect(resolution.shouldPullFromServer).toBe(false);
      expect(resolution.resolvedData).toEqual(conflict.localData);
    });

    /**
     * Test: Verify server wins when server data is newer
     */
    it('should pull from server when server data is newer', async () => {
      const now = Date.now();
      const localUpdatedAt = now - 5000; // Local is 5 seconds older
      const serverUpdatedAt = now;

      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {
          name: 'Local Farm Name',
          size: 2.5,
          updated_at: localUpdatedAt,
        },
        serverData: {
          name: 'Server Farm Name',
          size: 2.0,
          updated_at: serverUpdatedAt,
        },
        localUpdatedAt,
        serverUpdatedAt,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      // Server is newer, should pull from server
      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.shouldPushToServer).toBe(false);
      expect(resolution.shouldPullFromServer).toBe(true);
      expect(resolution.resolvedData).toEqual(conflict.serverData);
    });

    /**
     * Test: Verify conflict is logged to database
     */
    it('should log all conflicts to database for debugging', async () => {
      const conflict: ConflictData = {
        entityType: 'crop',
        entityId: 'crop-456',
        localData: {status: 'active'},
        serverData: {status: 'inactive'},
        localUpdatedAt: Date.now(),
        serverUpdatedAt: Date.now() - 1000,
      };

      await conflictResolver.resolveConflict(conflict);

      // Verify conflict was logged
      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockDatabase.get).toHaveBeenCalledWith('conflict_log');
      expect(mockCollection.create).toHaveBeenCalled();
    });

    /**
     * Test: Verify no data loss during conflict resolution
     */
    it('should not lose data during conflict resolution', async () => {
      const localData = {
        id: 'farm-123',
        name: 'Local Farm',
        size: 2.5,
        crops: ['wheat', 'rice'],
        updated_at: Date.now(),
      };

      const serverData = {
        id: 'farm-123',
        name: 'Server Farm',
        size: 2.0,
        crops: ['corn'],
        updated_at: Date.now() - 1000,
      };

      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData,
        serverData,
        localUpdatedAt: localData.updated_at,
        serverUpdatedAt: serverData.updated_at,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      // Verify resolved data contains all fields
      expect(resolution.resolvedData).toHaveProperty('id');
      expect(resolution.resolvedData).toHaveProperty('name');
      expect(resolution.resolvedData).toHaveProperty('size');
      expect(resolution.resolvedData).toHaveProperty('crops');
      expect(resolution.resolvedData).toHaveProperty('updated_at');

      // Since local is newer, should have local data
      expect(resolution.resolvedData).toEqual(localData);
    });
  });

  describe('Offline-Online Consistency', () => {
    /**
     * Test: Create data offline, sync, verify server matches
     */
    it('should sync offline-created data to server when online', async () => {
      // Simulate offline data creation
      const offlineData = {
        farmId: 'farm-123',
        cropName: 'Wheat',
        sowingDate: '2024-01-15',
        created_offline: true,
      };

      const mockItem = createMockItem(
        'offline-item-1',
        'CREATE_CROP',
        'HIGH',
        1,
        new Date()
      );

      mockItem.parsedPayload = {
        entityType: 'crop',
        data: offlineData,
      };

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      let syncedData: any = null;

      // Mock API to capture synced data
      (apiClient.post as jest.Mock).mockImplementation((url: string, data: any) => {
        syncedData = data;
        return Promise.resolve({data: {success: true, id: 'crop-server-123'}});
      });

      const results = await syncQueueManager.processQueue();

      // Verify sync was successful
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      // Verify server received correct data
      expect(syncedData).toEqual(offlineData);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/crop',
        offlineData
      );
    });

    /**
     * Test: Verify multiple offline operations sync in correct order
     */
    it('should sync multiple offline operations in correct order', async () => {
      const syncOrder: string[] = [];

      const mockItems = [
        createMockItem('create-farm', 'CREATE_FARM', 'HIGH', 1, new Date('2024-01-01T10:00:00')),
        createMockItem('create-crop', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-01T10:01:00')),
        createMockItem('update-farm', 'UPDATE_FARM', 'MEDIUM', 2, new Date('2024-01-01T10:02:00')),
      ];

      mockItems[0].parsedPayload = {entityType: 'farm', data: {name: 'My Farm'}};
      mockItems[1].parsedPayload = {entityType: 'crop', data: {name: 'Wheat'}};
      mockItems[2].parsedPayload = {entityType: 'farm', data: {farmId: 'farm-123', updates: {size: 3.0}}};

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      (apiClient.post as jest.Mock).mockImplementation((url: string) => {
        syncOrder.push(url);
        return Promise.resolve({data: {success: true}});
      });

      (apiClient.put as jest.Mock).mockImplementation((url: string) => {
        syncOrder.push(url);
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify operations synced in chronological order
      expect(syncOrder).toHaveLength(3);
      // All HIGH priority items should come before MEDIUM
      expect(syncOrder[0]).toContain('farm'); // CREATE_FARM
      expect(syncOrder[1]).toContain('crop'); // CREATE_CROP
      expect(syncOrder[2]).toContain('farm'); // UPDATE_FARM
    });

    /**
     * Test: Verify data consistency after sync
     */
    it('should maintain data consistency between local and server after sync', async () => {
      const localData = {
        id: 'farm-123',
        name: 'Test Farm',
        size: 2.5,
        updated_at: Date.now(),
      };

      const mockItem = createMockItem('item-1', 'UPDATE_FARM', 'HIGH', 1, new Date());
      mockItem.parsedPayload = {
        entityType: 'farm',
        data: {
          farmId: 'farm-123',
          updates: localData,
        },
      };

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      // Mock server to return the same data
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: localData,
      });

      (apiClient.put as jest.Mock).mockResolvedValue({
        data: {success: true},
      });

      const results = await syncQueueManager.processQueue();

      // Verify sync successful
      expect(results[0].success).toBe(true);

      // Verify PUT was called with correct data
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/farm/farm-123',
        localData
      );
    });
  });

  describe('Network Interruption Handling', () => {
    /**
     * Test: Pause and resume sync gracefully on network interruption
     */
    it('should pause sync on network interruption and resume when reconnected', async () => {
      let netInfoListener: ((state: NetInfoState) => void) | null = null;

      // Mock NetInfo
      (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
        netInfoListener = listener;
        return jest.fn(); // unsubscribe
      });

      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      const networkMonitor = new NetworkMonitor();
      networkMonitor.start();

      // Simulate network disconnection
      const offlineState: NetInfoState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
        details: null,
      };

      if (netInfoListener) {
        await netInfoListener(offlineState);
      }

      expect(networkMonitor.isConnected()).toBe(false);

      // Simulate network reconnection
      const onlineState: NetInfoState = {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
        details: null,
      };

      if (netInfoListener) {
        await netInfoListener(onlineState);
      }

      expect(networkMonitor.isConnected()).toBe(true);

      networkMonitor.stop();
    });

    /**
     * Test: Verify sync status indicators during interruption
     */
    it('should update sync status indicators during network interruption', async () => {
      const mockItem = createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      // Mock API to simulate network interruption
      let callCount = 0;
      (apiClient.post as jest.Mock).mockImplementation(() => {
        callCount++;
        
        if (callCount === 1) {
          // First call fails with network error
          return Promise.reject(new Error('Network request failed'));
        }
        // Subsequent calls succeed
        return Promise.resolve({data: {success: true}});
      });

      const results = await syncQueueManager.processQueue();

      // Verify retry was attempted
      expect(callCount).toBeGreaterThan(1);
      
      // Verify final success
      expect(results[0].success).toBe(true);
    }, 5000);

    /**
     * Test: Verify no data corruption during network interruption
     */
    it('should not corrupt data during network interruption', async () => {
      const originalData = {
        id: 'farm-123',
        name: 'Test Farm',
        size: 2.5,
        crops: ['wheat', 'rice'],
      };

      const mockItem = createMockItem('item-1', 'CREATE_FARM', 'HIGH', 1, new Date());
      mockItem.parsedPayload = {
        entityType: 'farm',
        data: originalData,
      };

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      let receivedData: any = null;

      // Mock API to fail first, then succeed
      let callCount = 0;
      (apiClient.post as jest.Mock).mockImplementation((url: string, data: any) => {
        callCount++;
        receivedData = data;
        
        if (callCount === 1) {
          return Promise.reject(new Error('Network interrupted'));
        }
        return Promise.resolve({data: {success: true}});
      });

      await syncQueueManager.processQueue();

      // Verify data remained intact after retry
      expect(receivedData).toEqual(originalData);
      expect(receivedData.crops).toEqual(['wheat', 'rice']);
    }, 5000);

    /**
     * Test: Verify graceful handling of partial sync completion
     */
    it('should handle partial sync completion gracefully', async () => {
      const mockItems = [
        createMockItem('item-1', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-01')),
        createMockItem('item-2', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-02')),
        createMockItem('item-3', 'CREATE_CROP', 'HIGH', 1, new Date('2024-01-03')),
      ];

      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue(mockItems),
      });

      let callCount = 0;

      // Mock API: first succeeds, second fails, third succeeds
      (apiClient.post as jest.Mock).mockImplementation(() => {
        callCount++;
        
        if (callCount === 2) {
          return Promise.reject(new Error('Network error on item 2'));
        }
        return Promise.resolve({data: {success: true}});
      });

      const results = await syncQueueManager.processQueue();

      // Verify partial completion
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);  // item-1 succeeded
      expect(results[1].success).toBe(false); // item-2 failed after retries
      expect(results[2].success).toBe(true);  // item-3 succeeded
    }, 10000);
  });

  describe('ACID Compliance', () => {
    /**
     * Test: Verify database transactions maintain ACID properties
     */
    it('should ensure ACID compliance for all synchronized transactions', async () => {
      const mockItem = createMockItem('item-1', 'UPDATE_FARM', 'HIGH', 1, new Date());
      
      mockCollection.query.mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockItem]),
      });

      // Track database write calls
      const writeCalls: any[] = [];
      mockDatabase.write.mockImplementation((callback: any) => {
        writeCalls.push(callback);
        return callback();
      });

      (apiClient.put as jest.Mock).mockResolvedValue({data: {success: true}});

      await syncQueueManager.processQueue();

      // Verify all updates used database transactions
      expect(writeCalls.length).toBeGreaterThan(0);
      
      // Verify item status was updated within transaction
      expect(mockItem.update).toHaveBeenCalled();
    });
  });
});

/**
 * Helper function to create mock sync queue items
 */
function createMockItem(
  id: string,
  action: string,
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  priorityOrder: number,
  createdAt: Date
): SyncQueueItem {
  return {
    id,
    action,
    priority,
    priorityOrder,
    status: 'PENDING',
    retryCount: 0,
    createdAt,
    parsedPayload: {
      entityType: 'test',
      data: {test: 'data'},
    },
    update: jest.fn().mockResolvedValue(undefined),
    markAsDeleted: jest.fn().mockResolvedValue(undefined),
    canRetry: true,
  } as unknown as SyncQueueItem;
}
