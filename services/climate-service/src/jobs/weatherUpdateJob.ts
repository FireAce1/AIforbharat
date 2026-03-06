import cron from 'node-cron';
import { config } from '../config';
import weatherService from '../services/weatherService';
import database from '../config/database';
import logger from '../utils/logger';

class WeatherUpdateJob {
  private task: cron.ScheduledTask | null = null;

  /**
   * Start the weather update cron job
   * Runs every 6 hours: 00:00, 06:00, 12:00, 18:00 IST
   */
  start(): void {
    if (this.task) {
      logger.warn('Weather update job already running');
      return;
    }

    logger.info('Starting weather update job', { 
      schedule: config.cron.weatherUpdate 
    });

    this.task = cron.schedule(config.cron.weatherUpdate, async () => {
      await this.runUpdate();
    });

    logger.info('Weather update job started successfully');
  }

  /**
   * Stop the weather update job
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Weather update job stopped');
    }
  }

  /**
   * Run weather update for all active farm locations
   */
  async runUpdate(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting scheduled weather update');

    try {
      // Get all unique farm locations
      const locationsQuery = `
        SELECT DISTINCT
          ST_X(location::geometry) as lng,
          ST_Y(location::geometry) as lat
        FROM farms
        WHERE location IS NOT NULL
      `;

      const result = await database.query(locationsQuery);
      const locations = result.rows;

      logger.info(`Found ${locations.length} unique farm locations to update`);

      let successCount = 0;
      let failureCount = 0;

      // Update weather for each location
      for (const location of locations) {
        try {
          await weatherService.updateWeatherForLocation(
            parseFloat(location.lat),
            parseFloat(location.lng)
          );
          successCount++;
        } catch (error) {
          failureCount++;
          logger.error('Failed to update weather for location', {
            lat: location.lat,
            lng: location.lng,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Weather update completed', {
        total: locations.length,
        success: successCount,
        failed: failureCount,
        duration: `${duration}ms`,
      });

      // Check for critical weather alerts
      await this.checkAndSendAlerts();

    } catch (error) {
      logger.error('Weather update job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check for critical weather and send alerts
   */
  private async checkAndSendAlerts(): Promise<void> {
    try {
      logger.info('Checking for critical weather alerts');

      const criticalAlerts = await weatherService.checkCriticalWeatherAlerts();

      if (criticalAlerts.length === 0) {
        logger.info('No critical weather alerts found');
        return;
      }

      logger.info(`Found ${criticalAlerts.length} critical weather alerts`);

      for (const alert of criticalAlerts) {
        logger.info('Critical weather alert', {
          location: alert.location,
          alerts: alert.alerts,
          affectedFarms: alert.affectedFarms.length,
        });

        // TODO: Send SMS alerts to affected farmers
        // This will be implemented when SMS service is integrated
        // For now, just log the alerts
      }

    } catch (error) {
      logger.error('Error checking critical weather alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Run update immediately (for testing or manual trigger)
   */
  async runNow(): Promise<void> {
    logger.info('Running weather update manually');
    await this.runUpdate();
  }
}

export default new WeatherUpdateJob();
