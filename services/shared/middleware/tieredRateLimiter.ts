/**
 * Tiered Rate Limiter for KrishiAI Platform
 * 
 * Implements different rate limits based on user tier:
 * - Free: Small farmers (< 2 hectares) - Basic limits
 * - Premium: Larger farms or paid subscribers - Higher limits
 * - Enterprise: FPO coordinators, extension officers - Highest limits
 * 
 * Features:
 * - Redis-based distributed rate limiting
 * - Adaptive throttling based on system load
 * - Graceful degradation
 * - Detailed metrics and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

export enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export interface TierLimits {
  requestsPerHour: number;
  requestsPerMinute: number;
  burstSize: number;
  concurrentRequests: number;
}

export interface RateLimitConfig {
  tiers: Record<UserTier, TierLimits>;
  enableAdaptiveThrottling: boolean;
  systemLoadThreshold: number; // 0-1, trigger throttling above this
}

export interface RateLimitMetrics {
  allowed: number;
  blocked: number;
  throttled: number;
  byTier: Record<UserTier, { allowed: number; blocked: number }>;
}

export class TieredRateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;
  private metrics: RateLimitMetrics;
  private systemLoad: number = 0;

  constructor(redis: Redis, config?: Partial<RateLimitConfig>) {
    this.redis = redis;
    this.config = {
      tiers: {
        [UserTier.FREE]: {
          requestsPerHour: 1000,
          requestsPerMinute: 50,
          burstSize: 10,
          concurrentRequests: 5,
        },
        [UserTier.PREMIUM]: {
          requestsPerHour: 5000,
          requestsPerMinute: 200,
          burstSize: 50,
          concurrentRequests: 20,
        },
        [UserTier.ENTERPRISE]: {
          requestsPerHour: 20000,
          requestsPerMinute: 500,
          burstSize: 100,
          concurrentRequests: 50,
        },
      },
      enableAdaptiveThrottling: true,
      systemLoadThreshold: 0.8,
      ...config,
    };

    this.metrics = this.initializeMetrics();
    this.startSystemLoadMonitoring();
  }

  /**
   * Rate limiting middleware
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id || 'anonymous';
        const userTier = await this.getUserTier(userId);
        const limits = this.config.tiers[userTier];

        // Check rate limits
        const allowed = await this.checkRateLimit(userId, userTier, limits);

        if (!allowed) {
          this.metrics.blocked++;
          this.metrics.byTier[userTier].blocked++;

          const retryAfter = await this.getRetryAfter(userId);

          return res.status(429).json({
            error: 'Rate Limit Exceeded',
            message: `You have exceeded your ${userTier} tier rate limit`,
            tier: userTier,
            limits: {
              requestsPerHour: limits.requestsPerHour,
              requestsPerMinute: limits.requestsPerMinute,
            },
            retryAfter,
          });
        }

        // Check adaptive throttling
        if (this.config.enableAdaptiveThrottling && this.shouldThrottle(userTier)) {
          this.metrics.throttled++;
          
          // Add artificial delay based on system load
          const delay = this.calculateThrottleDelay(userTier);
          await this.sleep(delay);
        }

        this.metrics.allowed++;
        this.metrics.byTier[userTier].allowed++;

        // Add rate limit headers
        this.addRateLimitHeaders(res, userId, userTier, limits);

        next();
      } catch (error) {
        logger.error('Rate limiter error:', error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  /**
   * Check if request is within rate limits
   */
  private async checkRateLimit(
    userId: string,
    tier: UserTier,
    limits: TierLimits
  ): Promise<boolean> {
    const now = Date.now();
    const hourKey = `ratelimit:${userId}:hour:${Math.floor(now / 3600000)}`;
    const minuteKey = `ratelimit:${userId}:minute:${Math.floor(now / 60000)}`;
    const concurrentKey = `ratelimit:${userId}:concurrent`;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();

    // Check hourly limit
    pipeline.incr(hourKey);
    pipeline.expire(hourKey, 3600);

    // Check minute limit
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60);

    // Check concurrent requests
    pipeline.incr(concurrentKey);

    const results = await pipeline.exec();

    if (!results) {
      return true; // Fail open
    }

    const hourCount = results[0][1] as number;
    const minuteCount = results[2][1] as number;
    const concurrentCount = results[4][1] as number;

    // Check limits
    if (hourCount > limits.requestsPerHour) {
      await this.redis.decr(concurrentKey);
      return false;
    }

    if (minuteCount > limits.requestsPerMinute) {
      await this.redis.decr(concurrentKey);
      return false;
    }

    if (concurrentCount > limits.concurrentRequests) {
      await this.redis.decr(concurrentKey);
      return false;
    }

    // Decrement concurrent counter after request completes
    // (This should be done in response finish handler)
    return true;
  }

  /**
   * Get user tier based on user profile
   */
  private async getUserTier(userId: string): Promise<UserTier> {
    if (userId === 'anonymous') {
      return UserTier.FREE;
    }

    try {
      // Check cache first
      const cachedTier = await this.redis.get(`user:${userId}:tier`);
      if (cachedTier) {
        return cachedTier as UserTier;
      }

      // Fetch from database (implement based on your user model)
      // For now, default to FREE
      const tier = UserTier.FREE;

      // Cache for 1 hour
      await this.redis.setex(`user:${userId}:tier`, 3600, tier);

      return tier;
    } catch (error) {
      logger.error('Error getting user tier:', error);
      return UserTier.FREE;
    }
  }

  /**
   * Check if request should be throttled based on system load
   */
  private shouldThrottle(tier: UserTier): boolean {
    if (!this.config.enableAdaptiveThrottling) {
      return false;
    }

    // Don't throttle enterprise tier
    if (tier === UserTier.ENTERPRISE) {
      return false;
    }

    // Throttle if system load is high
    if (this.systemLoad > this.config.systemLoadThreshold) {
      // Throttle free tier more aggressively
      if (tier === UserTier.FREE) {
        return this.systemLoad > this.config.systemLoadThreshold * 0.7;
      }
      return true;
    }

    return false;
  }

  /**
   * Calculate throttle delay based on system load and tier
   */
  private calculateThrottleDelay(tier: UserTier): number {
    const baseDelay = 100; // ms
    const loadFactor = Math.max(0, this.systemLoad - this.config.systemLoadThreshold);

    // Free tier gets longer delays
    const tierMultiplier = tier === UserTier.FREE ? 2 : 1;

    return baseDelay * loadFactor * tierMultiplier * 10;
  }

  /**
   * Get retry-after time in seconds
   */
  private async getRetryAfter(userId: string): Promise<number> {
    const now = Date.now();
    const minuteKey = `ratelimit:${userId}:minute:${Math.floor(now / 60000)}`;
    
    const ttl = await this.redis.ttl(minuteKey);
    return Math.max(ttl, 60);
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    res: Response,
    userId: string,
    tier: UserTier,
    limits: TierLimits
  ): void {
    res.setHeader('X-RateLimit-Tier', tier);
    res.setHeader('X-RateLimit-Limit-Hour', limits.requestsPerHour.toString());
    res.setHeader('X-RateLimit-Limit-Minute', limits.requestsPerMinute.toString());
    
    // Add remaining count (async, best effort)
    this.getRemainingRequests(userId).then(remaining => {
      res.setHeader('X-RateLimit-Remaining-Hour', remaining.hour.toString());
      res.setHeader('X-RateLimit-Remaining-Minute', remaining.minute.toString());
    }).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Get remaining requests for user
   */
  private async getRemainingRequests(userId: string): Promise<{ hour: number; minute: number }> {
    const now = Date.now();
    const hourKey = `ratelimit:${userId}:hour:${Math.floor(now / 3600000)}`;
    const minuteKey = `ratelimit:${userId}:minute:${Math.floor(now / 60000)}`;

    const tier = await this.getUserTier(userId);
    const limits = this.config.tiers[tier];

    const [hourCount, minuteCount] = await Promise.all([
      this.redis.get(hourKey).then(v => parseInt(v || '0')),
      this.redis.get(minuteKey).then(v => parseInt(v || '0')),
    ]);

    return {
      hour: Math.max(0, limits.requestsPerHour - hourCount),
      minute: Math.max(0, limits.requestsPerMinute - minuteCount),
    };
  }

  /**
   * Start monitoring system load
   */
  private startSystemLoadMonitoring(): void {
    setInterval(async () => {
      try {
        // Get system metrics from Redis or monitoring system
        // For now, use a simple heuristic based on Redis memory usage
        const info = await this.redis.info('memory');
        const usedMemory = this.parseRedisInfo(info, 'used_memory');
        const maxMemory = this.parseRedisInfo(info, 'maxmemory');

        if (maxMemory > 0) {
          this.systemLoad = usedMemory / maxMemory;
        } else {
          this.systemLoad = 0;
        }
      } catch (error) {
        logger.error('Error monitoring system load:', error);
      }
    }, 10000); // Update every 10 seconds
  }

  /**
   * Parse Redis INFO output
   */
  private parseRedisInfo(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): RateLimitMetrics {
    return {
      allowed: 0,
      blocked: 0,
      throttled: 0,
      byTier: {
        [UserTier.FREE]: { allowed: 0, blocked: 0 },
        [UserTier.PREMIUM]: { allowed: 0, blocked: 0 },
        [UserTier.ENTERPRISE]: { allowed: 0, blocked: 0 },
      },
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): RateLimitMetrics & { systemLoad: number } {
    return {
      ...this.metrics,
      systemLoad: this.systemLoad,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }
}

export default TieredRateLimiter;
