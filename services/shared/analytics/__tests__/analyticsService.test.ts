import analyticsService from '../analyticsService';
import { createClient } from 'redis';

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    setEx: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  })),
}));

describe('BackendAnalyticsService', () => {
  let mockRedisClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisClient = (createClient as jest.Mock)();
    await analyticsService.initialize();
  });

  describe('initialize', () => {
    it('should connect to Redis', async () => {
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });
  });

  describe('trackEvent', () => {
    it('should store event in Redis', async () => {
      const event = {
        event_name: 'disease_detected',
        user_id: 'user123',
        timestamp: new Date(),
        properties: { disease_name: 'Tomato Late Blight' },
        platform: 'android',
      };

      await analyticsService.trackEvent(event);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('analytics:events:disease_detected'),
        86400,
        expect.any(String)
      );
    });

    it('should update feature usage counter', async () => {
      const event = {
        event_name: 'disease_detected',
        timestamp: new Date(),
        properties: {},
        platform: 'android',
      };

      await analyticsService.trackEvent(event);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        'analytics:feature_usage:disease_detected'
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        'analytics:feature_usage:disease_detected',
        2592000
      );
    });
  });

  describe('getUserMetrics', () => {
    it('should return user metrics if exists', async () => {
      const metrics = {
        user_id: 'user123',
        total_sessions: 10,
        total_events: 50,
        last_active: new Date(),
        retention_days: 7,
        features_used: ['disease_detected', 'crop_recommended'],
      };

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(metrics));

      const result = await analyticsService.getUserMetrics('user123');

      expect(result).toEqual(metrics);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        'analytics:user_metrics:user123'
      );
    });

    it('should return null if user metrics not found', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await analyticsService.getUserMetrics('user123');

      expect(result).toBeNull();
    });
  });

  describe('getFeatureUsage', () => {
    it('should return feature usage statistics', async () => {
      mockRedisClient.keys.mockResolvedValueOnce([
        'analytics:feature_usage:disease_detected',
        'analytics:feature_usage:crop_recommended',
      ]);
      mockRedisClient.get
        .mockResolvedValueOnce('100')
        .mockResolvedValueOnce('50');

      const result = await analyticsService.getFeatureUsage();

      expect(result).toEqual({
        disease_detected: 100,
        crop_recommended: 50,
      });
    });
  });

  describe('calculateRetentionRate', () => {
    it('should calculate 7-day retention rate', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6);

      mockRedisClient.keys.mockResolvedValueOnce([
        'analytics:user_metrics:user1',
        'analytics:user_metrics:user2',
        'analytics:user_metrics:user3',
      ]);

      mockRedisClient.get
        .mockResolvedValueOnce(
          JSON.stringify({
            user_id: 'user1',
            last_active: sixDaysAgo.toISOString(),
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            user_id: 'user2',
            last_active: now.toISOString(),
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            user_id: 'user3',
            last_active: new Date('2020-01-01').toISOString(),
          })
        );

      const result = await analyticsService.calculateRetentionRate(7);

      expect(result).toBeCloseTo(66.67, 1); // 2 out of 3 users active
    });
  });

  describe('getTopFeatures', () => {
    it('should return top features sorted by usage', async () => {
      mockRedisClient.keys.mockResolvedValueOnce([
        'analytics:feature_usage:disease_detected',
        'analytics:feature_usage:crop_recommended',
        'analytics:feature_usage:price_checked',
      ]);

      mockRedisClient.get
        .mockResolvedValueOnce('100')
        .mockResolvedValueOnce('200')
        .mockResolvedValueOnce('50');

      const result = await analyticsService.getTopFeatures(2);

      expect(result).toEqual([
        { feature: 'crop_recommended', count: 200 },
        { feature: 'disease_detected', count: 100 },
      ]);
      expect(result.length).toBe(2);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive analytics report', async () => {
      const now = new Date();
      mockRedisClient.keys
        .mockResolvedValueOnce(['analytics:user_metrics:user1'])
        .mockResolvedValueOnce(['analytics:user_metrics:user1'])
        .mockResolvedValueOnce(['analytics:user_metrics:user1'])
        .mockResolvedValueOnce(['analytics:user_metrics:user1'])
        .mockResolvedValueOnce([
          'analytics:feature_usage:disease_detected',
        ])
        .mockResolvedValueOnce(['analytics:events:1']);

      mockRedisClient.get
        .mockResolvedValueOnce(
          JSON.stringify({ user_id: 'user1', last_active: now.toISOString() })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ user_id: 'user1', last_active: now.toISOString() })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ user_id: 'user1', last_active: now.toISOString() })
        )
        .mockResolvedValueOnce('100');

      const report = await analyticsService.generateReport();

      expect(report).toMatchObject({
        total_users: 1,
        active_users_7d: 1,
        retention_rate_7d: expect.any(Number),
        retention_rate_30d: expect.any(Number),
        top_features: expect.any(Array),
        total_events: 1,
      });
    });
  });
});
