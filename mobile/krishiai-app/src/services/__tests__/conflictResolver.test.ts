import {ConflictResolver, ConflictData, ConflictStrategy} from '../conflictResolver';

// Mock database for testing
const mockDatabase = {
  write: jest.fn((callback) => callback()),
  get: jest.fn(() => ({
    create: jest.fn((callback) => {
      const mockLog = {
        entityType: '',
        entityId: '',
        localData: '',
        serverData: '',
        localUpdatedAt: 0,
        serverUpdatedAt: 0,
        resolutionStrategy: '',
        resolvedData: '',
        resolvedAt: 0,
      };
      callback(mockLog);
      return Promise.resolve(mockLog);
    }),
    query: jest.fn(() => ({
      fetch: jest.fn(() => Promise.resolve([])),
    })),
  })),
} as any;

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    conflictResolver = new ConflictResolver(mockDatabase);
    jest.clearAllMocks();
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with last-write-wins when local is newer', async () => {
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: Date.now(),
        serverUpdatedAt: Date.now() - 10000, // 10 seconds ago
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.resolvedData).toEqual(conflict.localData);
      expect(resolution.shouldPushToServer).toBe(true);
      expect(resolution.shouldPullFromServer).toBe(false);
    });

    it('should resolve conflict with last-write-wins when server is newer', async () => {
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: Date.now() - 10000, // 10 seconds ago
        serverUpdatedAt: Date.now(),
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.resolvedData).toEqual(conflict.serverData);
      expect(resolution.shouldPushToServer).toBe(false);
      expect(resolution.shouldPullFromServer).toBe(true);
    });

    it('should prefer server when timestamps are equal', async () => {
      const timestamp = Date.now();
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: timestamp,
        serverUpdatedAt: timestamp,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      expect(resolution.strategy).toBe('last-write-wins');
      expect(resolution.resolvedData).toEqual(conflict.serverData);
      expect(resolution.shouldPushToServer).toBe(false);
      expect(resolution.shouldPullFromServer).toBe(true);
    });

    it('should resolve conflict with server-wins strategy', async () => {
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: Date.now(),
        serverUpdatedAt: Date.now() - 10000,
      };

      const resolution = await conflictResolver.resolveConflict(conflict, 'server-wins');

      expect(resolution.strategy).toBe('server-wins');
      expect(resolution.resolvedData).toEqual(conflict.serverData);
      expect(resolution.shouldPushToServer).toBe(false);
      expect(resolution.shouldPullFromServer).toBe(true);
    });

    it('should resolve conflict with local-wins strategy', async () => {
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: Date.now() - 10000,
        serverUpdatedAt: Date.now(),
      };

      const resolution = await conflictResolver.resolveConflict(conflict, 'local-wins');

      expect(resolution.strategy).toBe('local-wins');
      expect(resolution.resolvedData).toEqual(conflict.localData);
      expect(resolution.shouldPushToServer).toBe(true);
      expect(resolution.shouldPullFromServer).toBe(false);
    });

    it('should log conflict to database', async () => {
      const conflict: ConflictData = {
        entityType: 'farm',
        entityId: 'farm-123',
        localData: {name: 'Local Farm', size: 2.5},
        serverData: {name: 'Server Farm', size: 2.0},
        localUpdatedAt: Date.now(),
        serverUpdatedAt: Date.now() - 10000,
      };

      await conflictResolver.resolveConflict(conflict);

      // Verify database write was called
      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockDatabase.get).toHaveBeenCalledWith('conflict_log');
    });
  });

  describe('conflict resolution logic', () => {
    it('should correctly identify local as newer', async () => {
      const now = Date.now();
      const conflict: ConflictData = {
        entityType: 'crop',
        entityId: 'crop-456',
        localData: {status: 'active'},
        serverData: {status: 'inactive'},
        localUpdatedAt: now,
        serverUpdatedAt: now - 5000,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      expect(resolution.shouldPushToServer).toBe(true);
      expect(resolution.shouldPullFromServer).toBe(false);
    });

    it('should correctly identify server as newer', async () => {
      const now = Date.now();
      const conflict: ConflictData = {
        entityType: 'crop',
        entityId: 'crop-456',
        localData: {status: 'active'},
        serverData: {status: 'inactive'},
        localUpdatedAt: now - 5000,
        serverUpdatedAt: now,
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      expect(resolution.shouldPushToServer).toBe(false);
      expect(resolution.shouldPullFromServer).toBe(true);
    });

    it('should handle very small time differences', async () => {
      const now = Date.now();
      const conflict: ConflictData = {
        entityType: 'user',
        entityId: 'user-789',
        localData: {name: 'John'},
        serverData: {name: 'Jane'},
        localUpdatedAt: now,
        serverUpdatedAt: now - 1, // 1ms difference
      };

      const resolution = await conflictResolver.resolveConflict(conflict);

      // Local is newer by 1ms, should push
      expect(resolution.shouldPushToServer).toBe(true);
    });
  });

  describe('strategy selection', () => {
    const baseConflict: ConflictData = {
      entityType: 'farm',
      entityId: 'farm-123',
      localData: {value: 'local'},
      serverData: {value: 'server'},
      localUpdatedAt: Date.now(),
      serverUpdatedAt: Date.now() - 1000,
    };

    it('should use last-write-wins by default', async () => {
      const resolution = await conflictResolver.resolveConflict(baseConflict);
      expect(resolution.strategy).toBe('last-write-wins');
    });

    it('should use server-wins when specified', async () => {
      const resolution = await conflictResolver.resolveConflict(baseConflict, 'server-wins');
      expect(resolution.strategy).toBe('server-wins');
      expect(resolution.resolvedData).toEqual(baseConflict.serverData);
    });

    it('should use local-wins when specified', async () => {
      const resolution = await conflictResolver.resolveConflict(baseConflict, 'local-wins');
      expect(resolution.strategy).toBe('local-wins');
      expect(resolution.resolvedData).toEqual(baseConflict.localData);
    });
  });
});
