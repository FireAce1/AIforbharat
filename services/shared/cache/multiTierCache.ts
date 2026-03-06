/**
 * Multi-Tier Cache Manager for KrishiAI Platform
 * 
 * Implements a 3-tier caching strategy:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Redis distributed cache (fast, shared across instances)
 * - L3: CDN edge cache (for static assets and cacheable API responses)
 * 
 * Cache hierarchy:
 * 1. Check L1 (memory) - ~1ms
 * 2. If miss, check L2 (Redis) - ~5ms
 * 3. If miss, fetch from source and populate caches
 */

import { MemoryCacheManager } from './memoryCacheManager';
import logger from '../utils/logger';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  totalRequests: number;
  l1HitRate: number;
  l2HitRate: number;
  overallHitRate: number;
}

export class MultiTierCache {
  private l1Cache: MemoryCacheManager;
  private redisClient: any;
  private stats: {
    l1Hits: number;
    l1Misses: number;
    l2Hits: number;
    l2Misses: number;
  };

  constructor(
    redisClient: any,
    options?: {
      l1MaxSize?: number;
      l1MaxAge?: number;
    }
  ) {
    this.redisClient = redisClient;
    this.l1Cache = new MemoryCacheManager({
      maxSize: options?.l1MaxSize || 1000,
      maxAge: options?.l1MaxAge || 300000, // 5 minutes default
    });
    
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
    };
  }

  /**
   * Get value from cache (checks L1, then L2)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first (in-memory)
    const l1Value = this.l1Cache.get<T>(key);
    if (l1Value !== null) {
      this.stats.l1Hits++;
      logger.debug('Cache L1 HIT', { key });
      return l1Value;
    }
    
    this.stats.l1Misses++;
    
    // Try L2 cache (Redis)
    try {
      const l2Value = await this.redisClient.get(key);
      
      if (l2Value) {
        this.stats.l2Hits++;
        logger.debug('Cache L2 HIT', { key });
        
        const parsed = JSON.parse(l2Value) as T;
        
        // Populate L1 cache for future requests
        this.l1Cache.set(key, parsed);
        
        return parsed;
      }
      
      this.stats.l2Misses++;
      logger.debug('Cache MISS', { key });
      return null;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in both L1 and L2 caches
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    // Set in L1 cache (in-memory)
    this.l1Cache.set(key, value, ttl * 1000); // Convert to ms
    
    // Set in L2 cache (Redis)
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
      logger.debug('Cache SET', { key, ttl });
    } catch (error) {
      logger.error('Redis set error', { key, error });
    }
  }

  /**
   * Delete value from both caches
   */
  async delete(key: string): Promise<void> {
    // Delete from L1
    this.l1Cache.delete(key);
    
    // Delete from L2
    try {
      await this.redisClient.del(key);
      logger.debug('Cache DELETE', { key });
    } catch (error) {
      logger.error('Redis delete error', { key, error });
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;
    
    // Delete from L1 (pattern matching)
    deletedCount += this.l1Cache.deletePattern(pattern);
    
    // Delete from L2 (Redis SCAN + DEL)
    try {
      const keys = await this.scanKeys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(keys);
        deletedCount += keys.length;
        logger.debug('Cache DELETE PATTERN', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('Redis delete pattern error', { pattern, error });
    }
    
    return deletedCount;
  }

  /**
   * Get or set pattern: fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }
    
    // Cache miss - fetch from source
    try {
      const value = await fetcher();
      
      // Store in cache
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error('Fetcher error', { key, error });
      throw error;
    }
  }

  /**
   * Warm up cache with pre-computed values
   */
  async warmUp<T>(entries: Array<{ key: string; value: T; ttl: number }>): Promise<void> {
    logger.info('Cache warm-up started', { count: entries.length });
    
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
    
    logger.info('Cache warm-up completed', { count: entries.length });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = 
      this.stats.l1Hits + 
      this.stats.l1Misses;
    
    const l1HitRate = totalRequests > 0 
      ? (this.stats.l1Hits / totalRequests) * 100 
      : 0;
    
    const l2HitRate = this.stats.l1Misses > 0
      ? (this.stats.l2Hits / this.stats.l1Misses) * 100
      : 0;
    
    const overallHitRate = totalRequests > 0
      ? ((this.stats.l1Hits + this.stats.l2Hits) / totalRequests) * 100
      : 0;
    
    return {
      l1Hits: this.stats.l1Hits,
      l1Misses: this.stats.l1Misses,
      l2Hits: this.stats.l2Hits,
      l2Misses: this.stats.l2Misses,
      totalRequests,
      l1HitRate: Math.round(l1HitRate * 100) / 100,
      l2HitRate: Math.round(l2HitRate * 100) / 100,
      overallHitRate: Math.round(overallHitRate * 100) / 100,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    // Clear L1
    this.l1Cache.clear();
    
    // Clear L2 (Redis) - use with caution in production
    try {
      await this.redisClient.flushDb();
      logger.warn('Cache CLEAR ALL');
    } catch (error) {
      logger.error('Redis clear error', { error });
    }
  }

  /**
   * Get L1 cache size
   */
  getL1Size(): number {
    return this.l1Cache.size();
  }

  /**
   * Scan Redis keys matching pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;
    
    do {
      const result = await this.redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    
    return keys;
  }
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  // Market prices
  marketPrice: (crop: string, market: string) => 
    `market:price:${crop}:${market}`,
  
  marketPrices: (location: string, radius: number) => 
    `market:prices:${location}:${radius}`,
  
  priceForecast: (crop: string, days: number) => 
    `market:forecast:${crop}:${days}`,
  
  // Weather
  weatherForecast: (location: string) => 
    `climate:weather:${location}`,
  
  weatherAlert: (location: string) => 
    `climate:alert:${location}`,
  
  // Crop recommendations
  cropRecommendation: (farmId: string) => 
    `crop:recommendation:${farmId}`,
  
  // Government schemes
  schemes: (state: string, category: string) => 
    `govt:schemes:${state}:${category}`,
  
  schemeDetails: (schemeId: string) => 
    `govt:scheme:${schemeId}`,
  
  // User data
  userProfile: (userId: string) => 
    `user:profile:${userId}`,
  
  farmProfile: (farmId: string) => 
    `farm:profile:${farmId}`,
};

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  SHORT: 300,        // 5 minutes
  MEDIUM: 3600,      // 1 hour
  LONG: 86400,       // 24 hours
  WEEK: 604800,      // 7 days
  
  // Specific use cases
  MARKET_PRICE: 3600,           // 1 hour
  WEATHER_FORECAST: 21600,      // 6 hours
  CROP_RECOMMENDATION: 86400,   // 24 hours
  GOVERNMENT_SCHEME: 86400,     // 24 hours
  USER_PROFILE: 3600,           // 1 hour
};

export default MultiTierCache;
