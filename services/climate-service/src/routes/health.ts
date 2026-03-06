import { Router, Request, Response } from 'express';
import database from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'climate-service',
      checks: {
        database: false,
        redis: false,
      },
    };

    // Check database connection
    try {
      await database.testConnection();
      health.checks.database = true;
    } catch (error) {
      health.checks.database = false;
      health.status = 'unhealthy';
      logger.error('Database health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Check Redis connection
    try {
      await redis.set('health:check', 'ok', 10);
      const value = await redis.get('health:check');
      health.checks.redis = value === 'ok';
    } catch (error) {
      health.checks.redis = false;
      health.status = 'unhealthy';
      logger.error('Redis health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

/**
 * Readiness check endpoint
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if service is ready to accept requests
    const dbReady = await database.testConnection();
    
    if (dbReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        message: 'Database connection not available',
      });
    }
  } catch (error) {
    logger.error('Readiness check error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(503).json({
      status: 'not ready',
      message: 'Service not ready',
    });
  }
});

export default router;
