/**
 * Comprehensive Redis caching middleware for KrishiAI services
 * 
 * Features:
 * - Automatic cache key generation based on service:endpoint:params_hash
 * - Configurable TTL per endpoint
 * - X-Cache-Status header (HIT/MISS) for debugging
 * - Cache invalidation on POST/PUT/DELETE operations
 * - Cache hit/miss metrics tracking
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  keyPrefix?: string; // Optional prefix for cache keys
  excludeParams?: string[]; // Query params to exclude from cache key
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  invalidations: number;
}

export class CacheMiddleware {
  private redisClient: any;
  private serviceName: string;
  private metrics: CacheMetrics;

  constructor(redisClient: any, serviceName: string) {
    this.redisClient = redisClient;
    this.serviceName = serviceName;
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
    };
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(req: Request, config: CacheConfig): string {
    const { method, path, query, body } = req;
    
    // Filter out excluded params
    const filteredQuery = { ...query };
    if (config.excludeParams) {
      config.excludeParams.forEach(param => delete filteredQuery[param]);
    }
    
    // Create params object
    const params = {
      ...filteredQuery,
      ...(method === 'POST' || method === 'PUT' ? body : {}),
    };
    
    // Sort params for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    
    // Generate hash of params
    const paramsHash = crypto
      .createHash('md5')
      .update(JSON.stringify(sortedParams))
      .digest('hex')
      .substring(0, 8);
    
    // Format: service:endpoint:params_hash
    const prefix = config.keyPrefix || this.serviceName;
    const endpoint = path.replace(/^\/api\/v\d+\//, '').replace(/\//g, ':');
    
    return `${prefix}:${endpoint}:${paramsHash}`;
  }

  /**
   * Cache middleware for GET requests
   */
  cache(config: CacheConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      try {
        const cacheKey = this.generateCacheKey(req, config);
        
        // Try to get from cache
        const cachedData = await this.redisClient.get(cacheKey);
        
        if (cachedData) {
          // Cache HIT
          this.metrics.hits++;
          
          const data = JSON.parse(cachedData);
          
          // Add cache status header
          res.setHeader('X-Cache-Status', 'HIT');
          res.setHeader('X-Cache-Key', cacheKey);
          
          return res.json(data);
        }
        
        // Cache MISS - store original json method
        const originalJson = res.json.bind(res);
        
        res.json = (data: any) => {
          // Store in cache
          this.redisClient
            .setEx(cacheKey, config.ttl, JSON.stringify(data))
            .catch((err: Error) => {
              console.error('Cache set error:', err);
            });
          
          // Add cache status header
          res.setHeader('X-Cache-Status', 'MISS');
          res.setHeader('X-Cache-Key', cacheKey);
          
          this.metrics.misses++;
          
          return originalJson(data);
        };
        
        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        // Continue without caching on error
        next();
      }
    };
  }

  /**
   * Cache invalidation middleware for POST/PUT/DELETE requests
   */
  invalidate(patterns: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only invalidate on write operations
      if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        return next();
      }

      // Store original json method
      const originalJson = res.json.bind(res);
      
      res.json = async (data: any) => {
        // Invalidate cache after successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            for (const pattern of patterns) {
              const keys = await this.scanKeys(`${this.serviceName}:${pattern}*`);
              
              if (keys.length > 0) {
                await this.redisClient.del(keys);
                this.metrics.invalidations += keys.length;
                console.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
              }
            }
          } catch (error) {
            console.error('Cache invalidation error:', error);
          }
        }
        
        return originalJson(data);
      };
      
      next();
    };
  }

  /**
   * Scan for keys matching pattern
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

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      invalidations: 0,
    };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }
}

/**
 * Cache configuration presets for different endpoint types
 */
export const CachePresets = {
  // Market prices: 1 hour TTL
  PRICES: {
    ttl: 3600, // 1 hour
    keyPrefix: 'market',
  },
  
  // Weather forecasts: 6 hours TTL
  WEATHER: {
    ttl: 21600, // 6 hours
    keyPrefix: 'climate',
  },
  
  // Government schemes: 24 hours TTL
  SCHEMES: {
    ttl: 86400, // 24 hours
    keyPrefix: 'govt',
  },
  
  // Crop recommendations: 24 hours TTL
  CROP_RECOMMENDATIONS: {
    ttl: 86400, // 24 hours
    keyPrefix: 'crop',
  },
  
  // Short-lived cache: 5 minutes TTL
  SHORT: {
    ttl: 300, // 5 minutes
  },
  
  // Medium-lived cache: 1 hour TTL
  MEDIUM: {
    ttl: 3600, // 1 hour
  },
  
  // Long-lived cache: 24 hours TTL
  LONG: {
    ttl: 86400, // 24 hours
  },
};

export default CacheMiddleware;
