import { Router, Request, Response } from 'express';
import { cronService } from '../services/cronService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Manually trigger price data ingestion
 * POST /api/v1/admin/ingest
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    logger.info('Manual price data ingestion triggered via API');
    
    // Trigger ingestion asynchronously
    cronService.triggerPriceUpdate().catch((error) => {
      logger.error('Manual price ingestion failed', { error: error.message });
    });
    
    res.status(202).json({
      success: true,
      message: 'Price data ingestion started',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to trigger price ingestion', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'INGESTION_TRIGGER_FAILED',
        message: 'Failed to trigger price data ingestion',
      },
    });
  }
});

/**
 * Get cron job status
 * GET /api/v1/admin/cron-status
 */
router.get('/cron-status', (req: Request, res: Response) => {
  try {
    const status = cronService.getStatus();
    
    res.status(200).json({
      success: true,
      data: {
        jobs: status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get cron status', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'CRON_STATUS_FAILED',
        message: 'Failed to retrieve cron job status',
      },
    });
  }
});

export default router;
