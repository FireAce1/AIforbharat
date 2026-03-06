import { Router, Request, Response } from 'express';
import { database } from '../config/database';
import { redisClient } from '../config/redis';
import { cronService } from '../services/cronService';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await database.query('SELECT 1');
    
    // Check Redis connection
    await redisClient.get('health_check');
    
    // Get cron job status
    const cronStatus = cronService.getStatus();
    
    res.status(200).json({
      status: 'healthy',
      service: 'market-service',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        redis: 'connected',
        cronJobs: cronStatus,
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'market-service',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Readiness check endpoint
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    await database.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

export default router;
