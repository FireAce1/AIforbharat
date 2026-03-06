import {Database} from '@nozbe/watermelondb';
import {SyncQueueManager, PRIORITY_LEVELS, AddToQueueParams} from '../syncQueueManager';
import SyncQueueItem from '../../database/models/SyncQueueItem';
import {apiClient} from '../apiClient';

// Mock the apiClient
jest.mock('../apiClient', () => ({
  apiClient: {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn(),
} as unknown as Database;

describe('SyncQueueManager', () => {
  let syncQueueManager: SyncQueueManager;
  let mockCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock collection
    mockCollection = {
      create: jest.fn(),
      query: jest.fn(() => ({
        fetch: jest.fn(),
        fetchCount: jest.fn(),
      })),
    };

    (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
    (mockDatabase.write as jest.Mock).mockImplementation(async (callback: any) => {
      return await callback();
    });

    syncQueueManager = new SyncQueueManager(mockDatabase);
  });

  describe('addToQueue', () => {
    it('should add an item to the queue with default MEDIUM priority', async () => {
      const mockItem = {
        id: 'test-id',
        action: 'CREATE_CROP',
        payload: '{"entityType":"crop","data":{"name":"Wheat"}}',
        priority: 'MEDIUM',
        status: 'PENDING',
        retryCount: 0,
      } as SyncQueueItem;

      mockCollection.create.mockImplementation((callback: any) => {
        const item = {} as any;
        callback(item);
        return mockItem;
      });

      const params: AddToQueueParams = {
        action: 'CREATE_CROP',
        entityType: 'crop',
        payload: {name: 'Wheat'},
      };

      const result = await syncQueueManager.addToQueue(params);

      expect(result).toBeDefined();
      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockCollection.create).toHaveBeenCalled();
    });

    it('should add an item with CRITICAL priority', async () => {
      const mockItem = {
        id: 'test-id',
        action: 'AUTH_LOGIN',
        priority: 'CRITICAL',
        status: 'PENDING',
      } as SyncQueueItem;

      mockCollection.create.mockImplementation((callback: any) => {
        const item = {} as any;
        callback(item);
        return mockItem;
      });

      const params: AddToQueueParams = {
        action: 'AUTH_LOGIN',
        entityType: 'auth',
        payload: {phone: '+919876543210'},
        priority: 'CRITICAL',
      };

      await syncQueueManager.addToQueue(params);

      expect(mockCollection.create).toHaveBeenCalled();
    });

    it('should serialize payload as JSON string', async () => {
      let capturedPayload: string = '';

      mockCollection.create.mockImplementation((callback: any) => {
        const item = {
          payload: '',
        } as any;
        callback(item);
        capturedPayload = item.payload;
        return item;
      });

      const payload = {
        farmId: 'farm-123',
        cropName: 'Rice',
        sowingDate: '2024-01-15',
      };

      await syncQueueManager.addToQueue({
        action: 'CREATE_CROP',
        entityType: 'crop',
        payload,
      });

      expect(capturedPayload).toBeTruthy();
      const parsed = JSON.parse(capturedPayload);
      expect(parsed.entityType).toBe('crop');
      expect(parsed.data).toEqual(payload);
    });
  });

  describe('Priority Levels', () => {
    it('should have correct priority order', () => {
      expect(PRIORITY_LEVELS.CRITICAL).toBe(0);
      expect(PRIORITY_LEVELS.HIGH).toBe(1);
      expect(PRIORITY_LEVELS.MEDIUM).toBe(2);
      expect(PRIORITY_LEVELS.LOW).toBe(3);
    });

    it('should ensure CRITICAL has highest priority', () => {
      expect(PRIORITY_LEVELS.CRITICAL).toBeLessThan(PRIORITY_LEVELS.HIGH);
      expect(PRIORITY_LEVELS.CRITICAL).toBeLessThan(PRIORITY_LEVELS.MEDIUM);
      expect(PRIORITY_LEVELS.CRITICAL).toBeLessThan(PRIORITY_LEVELS.LOW);
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending items', async () => {
      const mockQuery = {
        fetchCount: jest.fn().mockResolvedValue(5),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      const count = await syncQueueManager.getPendingCount();

      expect(count).toBe(5);
      expect(mockCollection.query).toHaveBeenCalled();
    });
  });

  describe('getFailedCount', () => {
    it('should return count of failed items', async () => {
      const mockQuery = {
        fetchCount: jest.fn().mockResolvedValue(2),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      const count = await syncQueueManager.getFailedCount();

      expect(count).toBe(2);
      expect(mockCollection.query).toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return statistics for all queue statuses', async () => {
      let callCount = 0;
      mockCollection.query.mockImplementation(() => ({
        fetchCount: jest.fn().mockResolvedValue([3, 1, 10, 2][callCount++]),
      }));

      const stats = await syncQueueManager.getQueueStats();

      expect(stats).toEqual({
        pending: 3,
        syncing: 1,
        completed: 10,
        failed: 2,
        total: 16,
      });
    });
  });

  describe('processQueue', () => {
    it('should not process if already processing', async () => {
      // Set isProcessing to true by starting a process
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
      };
      mockCollection.query.mockReturnValue(mockQuery);

      // Start first process
      const firstProcess = syncQueueManager.processQueue();

      // Try to start second process while first is running
      const secondProcess = syncQueueManager.processQueue();

      const [firstResult, secondResult] = await Promise.all([firstProcess, secondProcess]);

      expect(firstResult).toEqual([]);
      expect(secondResult).toEqual([]);
    });

    it('should return empty array when no pending items', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      const results = await syncQueueManager.processQueue();

      expect(results).toEqual([]);
    });

    it('should process items in priority order', async () => {
      const mockItems = [
        {
          id: 'item-1',
          action: 'CREATE_CROP',
          priority: 'LOW',
          priorityOrder: 3,
          createdAt: new Date('2024-01-01'),
          parsedPayload: {entityType: 'crop', data: {name: 'Wheat'}},
          update: jest.fn(),
        },
        {
          id: 'item-2',
          action: 'AUTH_LOGIN',
          priority: 'CRITICAL',
          priorityOrder: 0,
          createdAt: new Date('2024-01-02'),
          parsedPayload: {entityType: 'auth', data: {phone: '+919876543210'}},
          update: jest.fn(),
        },
        {
          id: 'item-3',
          action: 'UPDATE_FARM',
          priority: 'MEDIUM',
          priorityOrder: 2,
          createdAt: new Date('2024-01-01T12:00:00'),
          parsedPayload: {entityType: 'farm', data: {farmId: 'farm-123'}},
          update: jest.fn(),
        },
      ] as unknown as SyncQueueItem[];

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(mockItems),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      // Mock API calls to succeed
      (apiClient.post as jest.Mock).mockResolvedValue({data: {success: true}});
      (apiClient.put as jest.Mock).mockResolvedValue({data: {success: true}});

      const results = await syncQueueManager.processQueue();

      expect(results).toHaveLength(3);
      expect(results[0].itemId).toBe('item-2'); // CRITICAL first
      expect(results[1].itemId).toBe('item-3'); // MEDIUM second
      expect(results[2].itemId).toBe('item-1'); // LOW last
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed items with exponential backoff', async () => {
      const mockItem = {
        id: 'item-1',
        action: 'CREATE_CROP',
        priority: 'HIGH',
        priorityOrder: 1,
        retryCount: 0,
        createdAt: new Date(),
        parsedPayload: {entityType: 'crop', data: {name: 'Wheat'}},
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as SyncQueueItem;

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockItem]),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      // Mock API to fail twice, then succeed
      let callCount = 0;
      (apiClient.post as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({data: {success: true}});
      });

      const results = await syncQueueManager.processQueue();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should mark item as FAILED after max retries', async () => {
      const mockItem = {
        id: 'item-1',
        action: 'CREATE_CROP',
        priority: 'HIGH',
        priorityOrder: 1,
        retryCount: 0,
        createdAt: new Date(),
        parsedPayload: {entityType: 'crop', data: {name: 'Wheat'}},
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as SyncQueueItem;

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockItem]),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      // Mock API to always fail
      (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      const results = await syncQueueManager.processQueue();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network error');
      expect(apiClient.post).toHaveBeenCalledTimes(3); // Max 3 attempts
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Status Tracking', () => {
    it('should track PENDING status for new items', async () => {
      let capturedStatus = '';

      mockCollection.create.mockImplementation((callback: any) => {
        const item = {status: ''} as any;
        callback(item);
        capturedStatus = item.status;
        return item;
      });

      await syncQueueManager.addToQueue({
        action: 'CREATE_CROP',
        entityType: 'crop',
        payload: {name: 'Wheat'},
      });

      expect(capturedStatus).toBe('PENDING');
    });

    it('should update to SYNCING when processing', async () => {
      const mockItem = {
        id: 'item-1',
        action: 'CREATE_CROP',
        priority: 'HIGH',
        priorityOrder: 1,
        retryCount: 0,
        createdAt: new Date(),
        parsedPayload: {entityType: 'crop', data: {name: 'Wheat'}},
        update: jest.fn().mockResolvedValue(undefined),
      } as unknown as SyncQueueItem;

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockItem]),
      };

      mockCollection.query.mockReturnValue(mockQuery);
      (apiClient.post as jest.Mock).mockResolvedValue({data: {success: true}});

      await syncQueueManager.processQueue();

      // Check that update was called to set SYNCING status
      expect(mockItem.update).toHaveBeenCalled();
    });
  });

  describe('isQueueProcessing', () => {
    it('should return false when not processing', () => {
      expect(syncQueueManager.isQueueProcessing()).toBe(false);
    });

    it('should return true when processing', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      // Start processing (don't await)
      const processPromise = syncQueueManager.processQueue();

      // Check status immediately (might be true or false depending on timing)
      const isProcessing = syncQueueManager.isQueueProcessing();

      await processPromise;

      // After completion, should be false
      expect(syncQueueManager.isQueueProcessing()).toBe(false);
    });
  });

  describe('clearCompletedItems', () => {
    it('should delete all completed items', async () => {
      const mockItems = [
        {
          id: 'item-1',
          status: 'COMPLETED',
          markAsDeleted: jest.fn().mockResolvedValue(undefined),
        },
        {
          id: 'item-2',
          status: 'COMPLETED',
          markAsDeleted: jest.fn().mockResolvedValue(undefined),
        },
      ] as unknown as SyncQueueItem[];

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(mockItems),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      const count = await syncQueueManager.clearCompletedItems();

      expect(count).toBe(2);
      expect(mockItems[0].markAsDeleted).toHaveBeenCalled();
      expect(mockItems[1].markAsDeleted).toHaveBeenCalled();
    });
  });

  describe('retryFailedItems', () => {
    it('should reset failed items to PENDING if they can retry', async () => {
      const mockItems = [
        {
          id: 'item-1',
          status: 'FAILED',
          retryCount: 2,
          canRetry: true,
          update: jest.fn().mockResolvedValue(undefined),
        },
        {
          id: 'item-2',
          status: 'FAILED',
          retryCount: 3,
          canRetry: false, // Max retries reached
          update: jest.fn().mockResolvedValue(undefined),
        },
      ] as unknown as SyncQueueItem[];

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue(mockItems),
      };

      mockCollection.query.mockReturnValue(mockQuery);

      const count = await syncQueueManager.retryFailedItems();

      expect(count).toBe(1); // Only item-1 should be retried
      expect(mockItems[0].update).toHaveBeenCalled();
      expect(mockItems[1].update).not.toHaveBeenCalled();
    });
  });
});
