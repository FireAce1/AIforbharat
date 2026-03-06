import cron from 'node-cron';
import { ingestionService } from './ingestionService';
import { alertService } from './alertService';
import { config } from '../config';
import { logger } from '../utils/logger';

export class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all cron jobs
   */
  init(): void {
    this.schedulePriceUpdates();
    this.scheduleAlertChecks();
    logger.info('Cron service initialized');
  }

  /**
   * Schedule daily price updates at 6:00 AM IST
   */
  private schedulePriceUpdates(): void {
    const cronExpression = config.cron.priceUpdate;
    
    const job = cron.schedule(
      cronExpression,
      async () => {
        logger.info('Starting scheduled price data ingestion');
        try {
          await ingestionService.ingestPriceData();
          logger.info('Scheduled price data ingestion completed successfully');
        } catch (error: any) {
          logger.error('Scheduled price data ingestion failed', { error: error.message });
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Kolkata', // IST timezone
      }
    );

    this.jobs.set('priceUpdate', job);
    logger.info(`Price update cron job scheduled: ${cronExpression} (IST)`);
  }

  /**
   * Manually trigger price data ingestion
   */
  async triggerPriceUpdate(): Promise<void> {
    logger.info('Manually triggering price data ingestion');
    await ingestionService.ingestPriceData();
  }

  /**
   * Schedule hourly price alert checks
   */
  private scheduleAlertChecks(): void {
    // Check alerts every hour
    const cronExpression = '0 * * * *'; // Every hour at minute 0
    
    const job = cron.schedule(
      cronExpression,
      async () => {
        logger.info('Starting scheduled price alert check');
        try {
          await alertService.checkAndNotifyAlerts();
          logger.info('Scheduled price alert check completed successfully');
        } catch (error: any) {
          logger.error('Scheduled price alert check failed', { error: error.message });
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Kolkata', // IST timezone
      }
    );

    this.jobs.set('alertCheck', job);
    logger.info(`Price alert check cron job scheduled: ${cronExpression} (IST)`);
  }

  /**
   * Manually trigger alert check
   */
  async triggerAlertCheck(): Promise<void> {
    logger.info('Manually triggering price alert check');
    await alertService.checkAndNotifyAlerts();
  }

  /**
   * Stop all cron jobs
   */
  stopAll(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped cron job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Get status of all cron jobs
   */
  getStatus(): { name: string; running: boolean }[] {
    const status: { name: string; running: boolean }[] = [];
    this.jobs.forEach((job, name) => {
      status.push({
        name,
        running: job.getStatus() === 'scheduled',
      });
    });
    return status;
  }
}

export const cronService = new CronService();
