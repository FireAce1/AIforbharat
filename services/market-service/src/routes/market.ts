import { Router, Request, Response, NextFunction } from 'express';
import { priceService } from '../services/priceService';
import { forecastService } from '../services/forecastService';
import { alertService } from '../services/alertService';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';
import CacheMiddleware, { CachePresets } from '../../../shared/middleware/cacheMiddleware';
import { apiRateLimiter, mlRateLimiter } from '../../../shared/middleware/rateLimiter';

const router = Router();

// Initialize cache middleware
const cacheMiddleware = new CacheMiddleware(redisClient.getClient(), 'market');

/**
 * GET /api/v1/market/prices
 * Get current market prices with geospatial queries
 * 
 * Query params:
 * - crop_name: string (required)
 * - latitude: number (required)
 * - longitude: number (required)
 * - radius_km: number (optional, default: 50)
 * - limit: number (optional, default: 5)
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/prices', apiRateLimiter, cacheMiddleware.cache(CachePresets.PRICES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { crop_name, latitude, longitude, radius_km, limit } = req.query;
    
    // Validation
    if (!crop_name || !latitude || !longitude) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['crop_name', 'latitude', 'longitude'],
      });
      return;
    }
    
    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    
    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({
        error: 'Invalid latitude or longitude',
      });
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        error: 'Latitude must be between -90 and 90, longitude between -180 and 180',
      });
      return;
    }
    
    const params = {
      crop_name: crop_name as string,
      latitude: lat,
      longitude: lng,
      radius_km: radius_km ? parseInt(radius_km as string, 10) : 50,
      limit: limit ? parseInt(limit as string, 10) : 5,
    };
    
    // Get prices
    const prices = await priceService.getPrices(params);
    
    // Get trends
    const trends = await priceService.getPriceTrends(params);
    
    // Get nearby mandis
    const mandis = await priceService.getNearbyMandis(lat, lng, params.radius_km, 10);
    
    res.json({
      success: true,
      data: {
        crop_name: params.crop_name,
        location: { latitude: lat, longitude: lng },
        radius_km: params.radius_km,
        prices,
        trends,
        nearby_mandis: mandis,
        updated_at: new Date().toISOString(),
      },
    });
    
    logger.info('Fetched market prices', {
      crop: params.crop_name,
      priceCount: prices.length,
      trendCount: trends.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/market/forecast
 * Get price forecast using ARIMA/LSTM ensemble
 * 
 * Query params:
 * - crop_name: string (required)
 * - market_name: string (required)
 * - days: 7 | 30 | 90 (optional, default: 7)
 * 
 * Rate limit: 50 requests per hour per user (ML inference)
 */
router.get('/forecast', mlRateLimiter, cacheMiddleware.cache(CachePresets.PRICES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { crop_name, market_name, days } = req.query;
    
    // Validation
    if (!crop_name || !market_name) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['crop_name', 'market_name'],
      });
      return;
    }
    
    const forecastDays = days ? parseInt(days as string, 10) : 7;
    
    if (![7, 30, 90].includes(forecastDays)) {
      res.status(400).json({
        error: 'Invalid forecast days',
        allowed: [7, 30, 90],
      });
      return;
    }
    
    const params = {
      crop_name: crop_name as string,
      market_name: market_name as string,
      days: forecastDays as 7 | 30 | 90,
    };
    
    const forecast = await forecastService.getForecast(params);
    
    res.json({
      success: true,
      data: forecast,
    });
    
    logger.info('Generated price forecast', {
      crop: params.crop_name,
      market: params.market_name,
      days: params.days,
      mape: forecast.accuracy_mape,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/market/forecast/multiple
 * Get forecasts for 7, 30, and 90 days
 * 
 * Query params:
 * - crop_name: string (required)
 * - market_name: string (required)
 * 
 * Rate limit: 50 requests per hour per user (ML inference)
 */
router.get('/forecast/multiple', mlRateLimiter, cacheMiddleware.cache(CachePresets.PRICES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { crop_name, market_name } = req.query;
    
    // Validation
    if (!crop_name || !market_name) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['crop_name', 'market_name'],
      });
      return;
    }
    
    const forecasts = await forecastService.getMultipleForecast(
      crop_name as string,
      market_name as string
    );
    
    res.json({
      success: true,
      data: forecasts,
    });
    
    logger.info('Generated multiple forecasts', {
      crop: crop_name,
      market: market_name,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/market/alerts
 * Create a price alert
 * 
 * Body:
 * - user_id: string (required)
 * - phone: string (required)
 * - crop_name: string (required)
 * - market_name: string (required)
 * - target_price: number (required)
 * - alert_type: 'above' | 'below' (required)
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.post('/alerts', apiRateLimiter, cacheMiddleware.invalidate(['prices:*', 'forecast:*']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user_id, phone, crop_name, market_name, target_price, alert_type } = req.body;
    
    // Validation
    if (!user_id || !phone || !crop_name || !market_name || !target_price || !alert_type) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'phone', 'crop_name', 'market_name', 'target_price', 'alert_type'],
      });
      return;
    }
    
    if (!['above', 'below'].includes(alert_type)) {
      res.status(400).json({
        error: 'Invalid alert_type',
        allowed: ['above', 'below'],
      });
      return;
    }
    
    if (typeof target_price !== 'number' || target_price <= 0) {
      res.status(400).json({
        error: 'target_price must be a positive number',
      });
      return;
    }
    
    // Validate phone number (Indian format)
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({
        error: 'Invalid phone number format',
        format: '+91XXXXXXXXXX',
      });
      return;
    }
    
    const alert = await alertService.createAlert({
      user_id,
      phone,
      crop_name,
      market_name,
      target_price,
      alert_type,
    });
    
    res.status(201).json({
      success: true,
      data: alert,
      message: 'Price alert created successfully',
    });
    
    logger.info('Created price alert', {
      userId: user_id,
      crop: crop_name,
      targetPrice: target_price,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/market/alerts/:userId
 * Get all active alerts for a user
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/alerts/:userId', apiRateLimiter, cacheMiddleware.cache({ ttl: 300 }), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const alerts = await alertService.getUserAlerts(userId);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/market/alerts/:alertId
 * Deactivate a price alert
 * 
 * Body:
 * - user_id: string (required)
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.delete('/alerts/:alertId', apiRateLimiter, cacheMiddleware.invalidate(['alerts:*']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { alertId } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      res.status(400).json({
        error: 'Missing required field: user_id',
      });
      return;
    }
    
    await alertService.deactivateAlert(alertId, user_id);
    
    res.json({
      success: true,
      message: 'Alert deactivated successfully',
    });
    
    logger.info('Deactivated alert', { alertId, userId: user_id });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/market/mandis
 * Get nearby mandis
 * 
 * Query params:
 * - latitude: number (required)
 * - longitude: number (required)
 * - radius_km: number (optional, default: 50)
 * - limit: number (optional, default: 10)
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/mandis', apiRateLimiter, cacheMiddleware.cache(CachePresets.PRICES), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { latitude, longitude, radius_km, limit } = req.query;
    
    // Validation
    if (!latitude || !longitude) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['latitude', 'longitude'],
      });
      return;
    }
    
    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    
    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({
        error: 'Invalid latitude or longitude',
      });
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        error: 'Latitude must be between -90 and 90, longitude between -180 and 180',
      });
      return;
    }
    
    const radiusKm = radius_km ? parseInt(radius_km as string, 10) : 50;
    const limitNum = limit ? parseInt(limit as string, 10) : 10;
    
    const mandis = await priceService.getNearbyMandis(lat, lng, radiusKm, limitNum);
    
    res.json({
      success: true,
      data: {
        location: { latitude: lat, longitude: lng },
        radius_km: radiusKm,
        mandis,
        count: mandis.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;


/**
 * GET /api/v1/market/cache/metrics
 * Get cache performance metrics
 */
router.get('/cache/metrics', async (req: Request, res: Response): Promise<void> => {
  const metrics = cacheMiddleware.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      hit_rate_percentage: cacheMiddleware.getHitRate().toFixed(2),
    },
  });
});
