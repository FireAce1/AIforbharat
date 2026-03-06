import { Router, Request, Response } from 'express';
import analyticsService from './analyticsService';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/analytics/track
 * Track analytics event from mobile app
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { event_name, properties, platform, app_version } = req.body;

    if (!event_name) {
      return res.status(400).json({
        success: false,
        error: 'event_name is required',
      });
    }

    await analyticsService.trackEvent({
      event_name,
      user_id: (req as any).user?.id,
      session_id: req.headers['x-session-id'] as string,
      timestamp: new Date(),
      properties: properties || {},
      platform: platform || 'unknown',
      app_version,
    });

    res.json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    logger.error('Failed to track event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event',
    });
  }
});

/**
 * GET /api/v1/analytics/user/:userId
 * Get user metrics
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const metrics = await analyticsService.getUserMetrics(userId);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'User metrics not found',
      });
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get user metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user metrics',
    });
  }
});

/**
 * GET /api/v1/analytics/features
 * Get feature usage statistics
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const usage = await analyticsService.getFeatureUsage();

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    logger.error('Failed to get feature usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get feature usage',
    });
  }
});

/**
 * GET /api/v1/analytics/top-features
 * Get top features by usage
 */
router.get('/top-features', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const topFeatures = await analyticsService.getTopFeatures(limit);

    res.json({
      success: true,
      data: topFeatures,
    });
  } catch (error) {
    logger.error('Failed to get top features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top features',
    });
  }
});

/**
 * GET /api/v1/analytics/retention
 * Get retention rate
 */
router.get('/retention', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const retentionRate = await analyticsService.calculateRetentionRate(days);

    res.json({
      success: true,
      data: {
        retention_rate: retentionRate,
        period_days: days,
      },
    });
  } catch (error) {
    logger.error('Failed to calculate retention rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate retention rate',
    });
  }
});

/**
 * GET /api/v1/analytics/report
 * Generate comprehensive analytics report
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await analyticsService.generateReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Failed to generate analytics report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics report',
    });
  }
});

export default router;
