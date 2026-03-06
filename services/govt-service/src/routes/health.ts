import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'govt-service',
      checks: {
        database: 'unknown',
        redis: 'unknown'
      }
    };

    // Check database connection
    try {
      await db.query('SELECT 1');
      health.checks.database = 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
      health.checks.database = 'unhealthy';
      health.status = 'degraded';
    }

    // Check Redis connection
    try {
      await redis.ping();
      health.checks.redis = 'healthy';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      health.checks.redis = 'unhealthy';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'govt-service',
      error: 'Health check failed'
    });
  }
});

export default router;
