import logger from '../utils/logger';
import redis from '../utils/redis';

export interface DataStalenessInfo {
  isStale: boolean;
  lastUpdated: Date;
  staleness: 'fresh' | 'recent' | 'stale' | 'very_stale';
  ageMinutes: number;
}

export interface ExternalDataResponse<T> {
  data: T;
  source: 'live' | 'cache';
  staleness?: DataStalenessInfo;
  cacheKey?: string;
}

export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Base class for external data integration with fallback mechanisms
 */
export abstract class ExternalDataService<T> {
  protected abstract serviceName: string;
  protected abstract cachePrefix: string;
  protected abstract cacheTTL: number; // in seconds
  protected abstract maxStaleTime: number; // in seconds - max time to use stale data

  /**
   * Fetch data with automatic fallback to cache
   */
  async fetchWithFallback(
    cacheKey: string,
    fetchFn: () => Promise<T>,
  ): Promise<ExternalDataResponse<T>> {
    const fullCacheKey = `${this.cachePrefix}${cacheKey}`;

    try {
      // Try to fetch fresh data
      logger.info(`Fetching fresh data from ${this.serviceName}`, {
        service: this.serviceName,
        cacheKey,
      });

      const freshData = await fetchFn();

      // Validate data before caching
      const validation = await this.validateData(freshData);
      if (!validation.isValid) {
        logger.error(`Data validation failed for ${this.serviceName}`, {
          service: this.serviceName,
          errors: validation.errors,
          warnings: validation.warnings,
        });

        // Try to use cached data if validation fails
        return await this.useCachedData(fullCacheKey, 'validation_failed');
      }

      if (validation.warnings.length > 0) {
        logger.warn(`Data validation warnings for ${this.serviceName}`, {
          service: this.serviceName,
          warnings: validation.warnings,
        });
      }

      // Cache the fresh data with metadata
      await this.cacheData(fullCacheKey, freshData);

      logger.info(`Fresh data fetched successfully from ${this.serviceName}`, {
        service: this.serviceName,
        cacheKey,
      });

      return {
        data: freshData,
        source: 'live',
        cacheKey: fullCacheKey,
      };
    } catch (error) {
      logger.error(`Failed to fetch data from ${this.serviceName}`, {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheKey,
      });

      // Fallback to cached data
      return await this.useCachedData(fullCacheKey, 'api_failure');
    }
  }

  /**
   * Use cached data as fallback
   */
  private async useCachedData(
    cacheKey: string,
    reason: string,
  ): Promise<ExternalDataResponse<T>> {
    try {
      const cachedData = await redis.get(cacheKey);
      const cacheMetadata = await redis.get(`${cacheKey}:metadata`);

      if (!cachedData) {
        logger.error(`No cached data available for ${this.serviceName}`, {
          service: this.serviceName,
          cacheKey,
          reason,
        });
        throw new Error(`No data available from ${this.serviceName}`);
      }

      const data = JSON.parse(cachedData) as T;
      const metadata = cacheMetadata
        ? JSON.parse(cacheMetadata)
        : {cachedAt: Date.now()};

      const staleness = this.calculateStaleness(metadata.cachedAt);

      // Check if data is too stale
      if (staleness.ageMinutes > this.maxStaleTime / 60) {
        logger.error(`Cached data too stale for ${this.serviceName}`, {
          service: this.serviceName,
          ageMinutes: staleness.ageMinutes,
          maxStaleMinutes: this.maxStaleTime / 60,
        });
        throw new Error(`Data too stale from ${this.serviceName}`);
      }

      logger.warn(`Using cached data for ${this.serviceName}`, {
        service: this.serviceName,
        cacheKey,
        reason,
        staleness: staleness.staleness,
        ageMinutes: staleness.ageMinutes,
      });

      // Increment fallback metric
      await this.incrementFallbackMetric(reason);

      return {
        data,
        source: 'cache',
        staleness,
        cacheKey,
      };
    } catch (error) {
      logger.error(`Failed to retrieve cached data for ${this.serviceName}`, {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cache data with metadata
   */
  private async cacheData(cacheKey: string, data: T): Promise<void> {
    try {
      const metadata = {
        cachedAt: Date.now(),
        service: this.serviceName,
      };

      await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(data));
      await redis.setex(
        `${cacheKey}:metadata`,
        this.cacheTTL,
        JSON.stringify(metadata),
      );

      logger.debug(`Data cached for ${this.serviceName}`, {
        service: this.serviceName,
        cacheKey,
        ttl: this.cacheTTL,
      });
    } catch (error) {
      logger.error(`Failed to cache data for ${this.serviceName}`, {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - caching failure shouldn't break the request
    }
  }

  /**
   * Calculate data staleness
   */
  private calculateStaleness(cachedAt: number): DataStalenessInfo {
    const now = Date.now();
    const ageMs = now - cachedAt;
    const ageMinutes = ageMs / (1000 * 60);

    let staleness: 'fresh' | 'recent' | 'stale' | 'very_stale';

    if (ageMinutes < 10) {
      staleness = 'fresh';
    } else if (ageMinutes < 60) {
      staleness = 'recent';
    } else if (ageMinutes < 360) {
      // 6 hours
      staleness = 'stale';
    } else {
      staleness = 'very_stale';
    }

    return {
      isStale: staleness !== 'fresh',
      lastUpdated: new Date(cachedAt),
      staleness,
      ageMinutes: Math.round(ageMinutes),
    };
  }

  /**
   * Increment fallback metric for monitoring
   */
  private async incrementFallbackMetric(reason: string): Promise<void> {
    try {
      const metricKey = `metrics:fallback:${this.serviceName}:${reason}`;
      await redis.incr(metricKey);
      await redis.expire(metricKey, 86400); // 24 hours
    } catch (error) {
      logger.error('Failed to increment fallback metric', {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Abstract method for data validation - must be implemented by subclasses
   */
  protected abstract validateData(data: T): Promise<DataValidationResult>;

  /**
   * Get fallback metrics for monitoring
   */
  async getFallbackMetrics(): Promise<Record<string, number>> {
    try {
      const pattern = `metrics:fallback:${this.serviceName}:*`;
      const keys = await redis.keys(pattern);

      const metrics: Record<string, number> = {};

      for (const key of keys) {
        const value = await redis.get(key);
        const reason = key.split(':').pop() || 'unknown';
        metrics[reason] = parseInt(value || '0', 10);
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get fallback metrics', {
        service: this.serviceName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }
}
