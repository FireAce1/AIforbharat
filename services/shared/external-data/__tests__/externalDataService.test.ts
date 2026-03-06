import { ExternalDataService, DataValidationResult } from '../externalDataService';
import redis from '../../utils/redis';

// Mock Redis
jest.mock('../../utils/redis');

// Test implementation of ExternalDataService
class TestExternalService extends ExternalDataService<string[]> {
  protected serviceName = 'TestService';
  protected cachePrefix = 'test:';
  protected cacheTTL = 3600;
  protected maxStaleTime = 7200;

  async fetchTestData(key: string): Promise<any> {
    return this.fetchWithFallback(key, async () => {
      return ['data1', 'data2', 'data3'];
    });
  }

  protected async validateData(data: string[]): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || data.length === 0) {
      errors.push('Data is empty');
    }

    if (data.length < 2) {
      warnings.push('Data has fewer than 2 items');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

describe('ExternalDataService', () => {
  let service: TestExternalService;

  beforeEach(() => {
    service = new TestExternalService();
    jest.clearAllMocks();
  });

  describe('fetchWithFallback', () => {
    it('should return fresh data when API call succeeds', async () => {
      // Mock Redis get to return null (no cache)
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await service.fetchTestData('test-key');

      expect(result.source).toBe('live');
      expect(result.data).toEqual(['data1', 'data2', 'data3']);
      expect(result.staleness).toBeUndefined();
    });

    it('should cache fresh data after successful fetch', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      await service.fetchTestData('test-key');

      expect(redis.setex).toHaveBeenCalledWith(
        'test:test-key',
        3600,
        expect.any(String),
      );
    });

    it('should use cached data when API call fails', async () => {
      const cachedData = ['cached1', 'cached2'];
      const cacheMetadata = {
        cachedAt: Date.now() - 1800000, // 30 minutes ago
        service: 'TestService',
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null) // First call for fresh data
        .mockResolvedValueOnce(JSON.stringify(cachedData)) // Fallback to cache
        .mockResolvedValueOnce(JSON.stringify(cacheMetadata)); // Cache metadata

      // Create a service that throws error
      class FailingService extends TestExternalService {
        async fetchTestData(key: string): Promise<any> {
          return this.fetchWithFallback(key, async () => {
            throw new Error('API Error');
          });
        }
      }

      const failingService = new FailingService();
      const result = await failingService.fetchTestData('test-key');

      expect(result.source).toBe('cache');
      expect(result.data).toEqual(cachedData);
      expect(result.staleness).toBeDefined();
      expect(result.staleness?.ageMinutes).toBeGreaterThan(0);
    });

    it('should calculate staleness correctly', async () => {
      const cachedData = ['cached1', 'cached2'];
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      const cacheMetadata = {
        cachedAt: thirtyMinutesAgo,
        service: 'TestService',
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(cachedData))
        .mockResolvedValueOnce(JSON.stringify(cacheMetadata));

      class FailingService extends TestExternalService {
        async fetchTestData(key: string): Promise<any> {
          return this.fetchWithFallback(key, async () => {
            throw new Error('API Error');
          });
        }
      }

      const failingService = new FailingService();
      const result = await failingService.fetchTestData('test-key');

      expect(result.staleness?.staleness).toBe('recent');
      expect(result.staleness?.ageMinutes).toBeGreaterThanOrEqual(30);
      expect(result.staleness?.isStale).toBe(true);
    });

    it('should reject data that is too stale', async () => {
      const cachedData = ['cached1', 'cached2'];
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000; // Beyond maxStaleTime
      const cacheMetadata = {
        cachedAt: threeHoursAgo,
        service: 'TestService',
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(cachedData))
        .mockResolvedValueOnce(JSON.stringify(cacheMetadata));

      class FailingService extends TestExternalService {
        async fetchTestData(key: string): Promise<any> {
          return this.fetchWithFallback(key, async () => {
            throw new Error('API Error');
          });
        }
      }

      const failingService = new FailingService();

      await expect(failingService.fetchTestData('test-key')).rejects.toThrow();
    });

    it('should use cached data when validation fails', async () => {
      const cachedData = ['cached1', 'cached2'];
      const cacheMetadata = {
        cachedAt: Date.now() - 1800000,
        service: 'TestService',
      };

      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(cachedData))
        .mockResolvedValueOnce(JSON.stringify(cacheMetadata));

      // Create service that returns invalid data
      class InvalidDataService extends TestExternalService {
        async fetchTestData(key: string): Promise<any> {
          return this.fetchWithFallback(key, async () => {
            return []; // Empty array - invalid
          });
        }
      }

      const invalidService = new InvalidDataService();
      const result = await invalidService.fetchTestData('test-key');

      expect(result.source).toBe('cache');
      expect(result.data).toEqual(cachedData);
    });
  });

  describe('validateData', () => {
    it('should validate data correctly', async () => {
      const validData = ['item1', 'item2', 'item3'];
      const result = await service['validateData'](validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty data', async () => {
      const invalidData: string[] = [];
      const result = await service['validateData'](invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data is empty');
    });

    it('should generate warnings for suspicious data', async () => {
      const suspiciousData = ['item1'];
      const result = await service['validateData'](suspiciousData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Data has fewer than 2 items');
    });
  });

  describe('getFallbackMetrics', () => {
    it('should retrieve fallback metrics', async () => {
      (redis.keys as jest.Mock).mockResolvedValue([
        'metrics:fallback:TestService:api_failure',
        'metrics:fallback:TestService:validation_failed',
      ]);

      (redis.get as jest.Mock)
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('2');

      const metrics = await service.getFallbackMetrics();

      expect(metrics).toEqual({
        api_failure: 5,
        validation_failed: 2,
      });
    });

    it('should handle missing metrics gracefully', async () => {
      (redis.keys as jest.Mock).mockResolvedValue([]);

      const metrics = await service.getFallbackMetrics();

      expect(metrics).toEqual({});
    });
  });
});
