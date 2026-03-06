import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import logger from '../utils/logger';

interface AnalyticsEvent {
  event_name: string;
  user_id?: string;
  session_id?: string;
  timestamp: Date;
  properties: Record<string, any>;
  platform: string;
  app_version?: string;
}

interface UserMetrics {
  user_id: string;
  total_sessions: number;
  total_events: number;
  last_active: Date;
  retention_days: number;
  features_used: string[];
}

class BackendAnalyticsService {
  private redisClient: ReturnType<typeof createClient>;
  private isInitialized = false;

  constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
      this.isInitialized = true;
      logger.info('Backend analytics service initialized');
    } catch (error) {
      logger.error('Failed to initialize backend analytics:', error);
    }
  }

  /**
   * Track event from mobile app
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Analytics service not initialized');
      return;
    }

    try {
      // Store event in Redis for real-time processing
      const eventKey = `analytics:events:${event.event_name}:${Date.now()}`;
      await this.redisClient.setEx(
        eventKey,
        86400, // 24 hours TTL
        JSON.stringify(event)
      );

      // Update user metrics
      if (event.user_id) {
        await this.updateUserMetrics(event.user_id, event);
      }

      // Update feature usage counters
      await this.updateFeatureUsage(event.event_name);

      logger.info(`Analytics event tracked: ${event.event_name}`, {
        user_id: event.user_id,
        event_name: event.event_name,
      });
    } catch (error) {
      logger.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Update user metrics
   */
  private async updateUserMetrics(
    userId: string,
    event: AnalyticsEvent
  ): Promise<void> {
    try {
      const metricsKey = `analytics:user_metrics:${userId}`;
      const existingMetrics = await this.redisClient.get(metricsKey);

      let metrics: UserMetrics;
      if (existingMetrics) {
        metrics = JSON.parse(existingMetrics);
        metrics.total_events += 1;
        metrics.last_active = new Date();

        // Update features used
        if (!metrics.features_used.includes(event.event_name)) {
          metrics.features_used.push(event.event_name);
        }

        // Calculate retention days
        const firstActive = new Date(metrics.last_active);
        const daysSinceFirst = Math.floor(
          (Date.now() - firstActive.getTime()) / (1000 * 60 * 60 * 24)
        );
        metrics.retention_days = daysSinceFirst;
      } else {
        metrics = {
          user_id: userId,
          total_sessions: 0,
          total_events: 1,
          last_active: new Date(),
          retention_days: 0,
          features_used: [event.event_name],
        };
      }

      // Increment session count for session_start events
      if (event.event_name === 'session_start') {
        metrics.total_sessions += 1;
      }

      await this.redisClient.setEx(
        metricsKey,
        2592000, // 30 days TTL
        JSON.stringify(metrics)
      );
    } catch (error) {
      logger.error('Failed to update user metrics:', error);
    }
  }

  /**
   * Update feature usage counters
   */
  private async updateFeatureUsage(eventName: string): Promise<void> {
    try {
      const counterKey = `analytics:feature_usage:${eventName}`;
      await this.redisClient.incr(counterKey);
      await this.redisClient.expire(counterKey, 2592000); // 30 days TTL
    } catch (error) {
      logger.error('Failed to update feature usage:', error);
    }
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(userId: string): Promise<UserMetrics | null> {
    try {
      const metricsKey = `analytics:user_metrics:${userId}`;
      const metrics = await this.redisClient.get(metricsKey);
      return metrics ? JSON.parse(metrics) : null;
    } catch (error) {
      logger.error('Failed to get user metrics:', error);
      return null;
    }
  }

  /**
   * Get feature usage statistics
   */
  async getFeatureUsage(): Promise<Record<string, number>> {
    try {
      const keys = await this.redisClient.keys('analytics:feature_usage:*');
      const usage: Record<string, number> = {};

      for (const key of keys) {
        const count = await this.redisClient.get(key);
        const featureName = key.replace('analytics:feature_usage:', '');
        usage[featureName] = parseInt(count || '0', 10);
      }

      return usage;
    } catch (error) {
      logger.error('Failed to get feature usage:', error);
      return {};
    }
  }

  /**
   * Calculate retention rate
   */
  async calculateRetentionRate(days: number = 7): Promise<number> {
    try {
      const keys = await this.redisClient.keys('analytics:user_metrics:*');
      let activeUsers = 0;
      let totalUsers = keys.length;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      for (const key of keys) {
        const metrics = await this.redisClient.get(key);
        if (metrics) {
          const userMetrics: UserMetrics = JSON.parse(metrics);
          if (new Date(userMetrics.last_active) >= cutoffDate) {
            activeUsers += 1;
          }
        }
      }

      return totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    } catch (error) {
      logger.error('Failed to calculate retention rate:', error);
      return 0;
    }
  }

  /**
   * Get top features by usage
   */
  async getTopFeatures(limit: number = 10): Promise<Array<{ feature: string; count: number }>> {
    try {
      const usage = await this.getFeatureUsage();
      const sorted = Object.entries(usage)
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      logger.error('Failed to get top features:', error);
      return [];
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(): Promise<{
    total_users: number;
    active_users_7d: number;
    retention_rate_7d: number;
    retention_rate_30d: number;
    top_features: Array<{ feature: string; count: number }>;
    total_events: number;
  }> {
    try {
      const userKeys = await this.redisClient.keys('analytics:user_metrics:*');
      const totalUsers = userKeys.length;

      // Count active users in last 7 days
      let activeUsers7d = 0;
      const cutoffDate7d = new Date();
      cutoffDate7d.setDate(cutoffDate7d.getDate() - 7);

      for (const key of userKeys) {
        const metrics = await this.redisClient.get(key);
        if (metrics) {
          const userMetrics: UserMetrics = JSON.parse(metrics);
          if (new Date(userMetrics.last_active) >= cutoffDate7d) {
            activeUsers7d += 1;
          }
        }
      }

      const retentionRate7d = await this.calculateRetentionRate(7);
      const retentionRate30d = await this.calculateRetentionRate(30);
      const topFeatures = await this.getTopFeatures(10);

      // Count total events
      const eventKeys = await this.redisClient.keys('analytics:events:*');
      const totalEvents = eventKeys.length;

      return {
        total_users: totalUsers,
        active_users_7d: activeUsers7d,
        retention_rate_7d: retentionRate7d,
        retention_rate_30d: retentionRate30d,
        top_features: topFeatures,
        total_events: totalEvents,
      };
    } catch (error) {
      logger.error('Failed to generate analytics report:', error);
      throw error;
    }
  }

  /**
   * Middleware to track API requests
   */
  trackApiRequest() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Track request
      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        const event: AnalyticsEvent = {
          event_name: 'api_request',
          user_id: (req as any).user?.id,
          timestamp: new Date(),
          properties: {
            method: req.method,
            path: req.path,
            status_code: res.statusCode,
            duration_ms: duration,
          },
          platform: 'backend',
        };

        await this.trackEvent(event);
      });

      next();
    };
  }
}

export default new BackendAnalyticsService();
