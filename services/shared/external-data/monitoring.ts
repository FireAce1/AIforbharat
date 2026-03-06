import logger from '../utils/logger';
import redis from '../utils/redis';
import { Counter, Gauge } from 'prom-client';

// Prometheus metrics for external API monitoring
export const externalApiFailures = new Counter({
  name: 'external_api_failures_total',
  help: 'Total number of external API failures',
  labelNames: ['service', 'reason'],
});

export const externalApiFallbacks = new Counter({
  name: 'external_api_fallbacks_total',
  help: 'Total number of times fallback to cache was used',
  labelNames: ['service', 'reason'],
});

export const externalApiResponseTime = new Gauge({
  name: 'external_api_response_time_seconds',
  help: 'Response time of external API calls',
  labelNames: ['service', 'status'],
});

export const cachedDataStaleness = new Gauge({
  name: 'cached_data_staleness_minutes',
  help: 'Age of cached data being served',
  labelNames: ['service'],
});

export interface AlertConfig {
  service: string;
  failureThreshold: number; // Number of failures before alerting
  timeWindowMinutes: number; // Time window for counting failures
  alertChannels: ('log' | 'sms' | 'email')[];
}

/**
 * Monitor external API health and send alerts
 */
export class ExternalAPIMonitor {
  private alertConfigs: Map<string, AlertConfig> = new Map();

  /**
   * Register a service for monitoring
   */
  registerService(config: AlertConfig): void {
    this.alertConfigs.set(config.service, config);
    logger.info('Registered external API monitoring', {
      service: config.service,
      failureThreshold: config.failureThreshold,
      timeWindowMinutes: config.timeWindowMinutes,
    });
  }

  /**
   * Record an API failure
   */
  async recordFailure(
    service: string,
    reason: string,
    error?: Error,
  ): Promise<void> {
    // Increment Prometheus counter
    externalApiFailures.inc({ service, reason });

    // Store failure in Redis for time-window tracking
    const failureKey = `api:failures:${service}`;
    const timestamp = Date.now();

    try {
      await redis.setex(
        `${failureKey}:${timestamp}`,
        3600, // 1 hour TTL
        JSON.stringify({
          service,
          reason,
          error: error?.message,
          timestamp,
        }),
      );

      // Check if we should send an alert
      await this.checkAndSendAlert(service);
    } catch (err) {
      logger.error('Failed to record API failure', {
        service,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    logger.error('External API failure recorded', {
      service,
      reason,
      error: error?.message,
    });
  }

  /**
   * Record a fallback to cache
   */
  async recordFallback(
    service: string,
    reason: string,
    stalenessMinutes: number,
  ): Promise<void> {
    // Increment Prometheus counters
    externalApiFallbacks.inc({ service, reason });
    cachedDataStaleness.set({ service }, stalenessMinutes);

    logger.warn('External API fallback used', {
      service,
      reason,
      stalenessMinutes,
    });
  }

  /**
   * Record API response time
   */
  recordResponseTime(
    service: string,
    status: 'success' | 'failure',
    durationMs: number,
  ): void {
    externalApiResponseTime.set({ service, status }, durationMs / 1000);
  }

  /**
   * Check failure count and send alert if threshold exceeded
   */
  private async checkAndSendAlert(service: string): Promise<void> {
    const config = this.alertConfigs.get(service);
    if (!config) {
      return;
    }

    try {
      // Get all failures in the time window
      const pattern = `api:failures:${service}:*`;
      const keys = await redis.keys(pattern);

      const now = Date.now();
      const timeWindowMs = config.timeWindowMinutes * 60 * 1000;
      let recentFailures = 0;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const failure = JSON.parse(data);
          if (now - failure.timestamp <= timeWindowMs) {
            recentFailures++;
          }
        }
      }

      // Send alert if threshold exceeded
      if (recentFailures >= config.failureThreshold) {
        await this.sendAlert(service, recentFailures, config);
      }
    } catch (error) {
      logger.error('Failed to check alert threshold', {
        service,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(
    service: string,
    failureCount: number,
    config: AlertConfig,
  ): Promise<void> {
    const message = `⚠️ ALERT: ${service} API has failed ${failureCount} times in the last ${config.timeWindowMinutes} minutes. System is using cached data.`;

    for (const channel of config.alertChannels) {
      try {
        switch (channel) {
          case 'log':
            logger.error('EXTERNAL API ALERT', {
              service,
              failureCount,
              timeWindowMinutes: config.timeWindowMinutes,
              message,
            });
            break;

          case 'sms':
            // TODO: Integrate with SMS gateway for critical alerts
            logger.warn('SMS alert not implemented', { service, message });
            break;

          case 'email':
            // TODO: Integrate with email service for alerts
            logger.warn('Email alert not implemented', { service, message });
            break;
        }
      } catch (error) {
        logger.error('Failed to send alert', {
          service,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Set a cooldown to avoid alert spam
    await redis.setex(
      `api:alert:cooldown:${service}`,
      config.timeWindowMinutes * 60,
      'true',
    );
  }

  /**
   * Get monitoring metrics for a service
   */
  async getMetrics(service: string): Promise<{
    recentFailures: number;
    totalFallbacks: number;
    lastFailureTime?: Date;
  }> {
    try {
      const pattern = `api:failures:${service}:*`;
      const keys = await redis.keys(pattern);

      let recentFailures = 0;
      let lastFailureTime: Date | undefined;

      const now = Date.now();
      const oneHourAgo = now - 3600000;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const failure = JSON.parse(data);
          if (failure.timestamp >= oneHourAgo) {
            recentFailures++;
            if (
              !lastFailureTime ||
              failure.timestamp > lastFailureTime.getTime()
            ) {
              lastFailureTime = new Date(failure.timestamp);
            }
          }
        }
      }

      // Get total fallbacks from metrics
      const fallbackPattern = `metrics:fallback:${service}:*`;
      const fallbackKeys = await redis.keys(fallbackPattern);
      let totalFallbacks = 0;

      for (const key of fallbackKeys) {
        const value = await redis.get(key);
        if (value) {
          totalFallbacks += parseInt(value, 10);
        }
      }

      return {
        recentFailures,
        totalFallbacks,
        lastFailureTime,
      };
    } catch (error) {
      logger.error('Failed to get monitoring metrics', {
        service,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        recentFailures: 0,
        totalFallbacks: 0,
      };
    }
  }

  /**
   * Clear failure history for a service
   */
  async clearFailures(service: string): Promise<void> {
    try {
      const pattern = `api:failures:${service}:*`;
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        await redis.del(key);
      }

      logger.info('Cleared failure history', { service });
    } catch (error) {
      logger.error('Failed to clear failure history', {
        service,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const apiMonitor = new ExternalAPIMonitor();

// Register default monitoring for IMD and Agmarknet
apiMonitor.registerService({
  service: 'IMD',
  failureThreshold: 3,
  timeWindowMinutes: 30,
  alertChannels: ['log'],
});

apiMonitor.registerService({
  service: 'Agmarknet',
  failureThreshold: 3,
  timeWindowMinutes: 30,
  alertChannels: ['log'],
});
