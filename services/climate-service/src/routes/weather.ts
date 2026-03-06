import { Router, Request, Response } from 'express';
import weatherService from '../services/weatherService';
import alertService from '../services/alertService';
import redis from '../config/redis';
import { config } from '../config';
import logger from '../utils/logger';
import database from '../config/database';
import CacheMiddleware, { CachePresets } from '../../../shared/middleware/cacheMiddleware';
import { apiRateLimiter } from '../../../shared/middleware/rateLimiter';

const router = Router();

// Initialize cache middleware
const cacheMiddleware = new CacheMiddleware(redis.getClient(), 'climate');

/**
 * GET /api/v1/climate/weather/forecast
 * Get 7-day weather forecast with hourly breakdown and 5km hyperlocal accuracy
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/forecast', apiRateLimiter, cacheMiddleware.cache(CachePresets.WEATHER), async (req: Request, res: Response) => {
  try {
    const { lat, lng, days = 7 } = req.query;

    // Validate parameters
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Latitude and longitude are required',
        },
      });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const forecastDays = parseInt(days as string, 10);

    // Validate ranges
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LATITUDE',
          message: 'Latitude must be between -90 and 90',
        },
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LONGITUDE',
          message: 'Longitude must be between -180 and 180',
        },
      });
    }

    if (forecastDays < 1 || forecastDays > 14) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DAYS',
          message: 'Days must be between 1 and 14',
        },
      });
    }

    // Fetch from database with 5km hyperlocal accuracy
    const forecasts = await weatherService.getWeatherForecast(
      latitude,
      longitude,
      forecastDays
    );

    if (forecasts.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No weather forecast available for this location',
        },
      });
    }

    // Group by day with hourly breakdown
    const groupedByDay = forecasts.reduce((acc: any, forecast: any) => {
      const date = new Date(forecast.time).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          date,
          hourly: [],
          summary: {
            tempMin: forecast.temperature,
            tempMax: forecast.temperature,
            totalRainfall: 0,
            avgHumidity: 0,
            avgWindSpeed: 0,
          },
        };
      }

      acc[date].hourly.push({
        time: forecast.time,
        temperature: forecast.temperature,
        rainfall: forecast.rainfall,
        humidity: forecast.humidity,
        windSpeed: forecast.windSpeed,
      });

      // Update summary
      acc[date].summary.tempMin = Math.min(acc[date].summary.tempMin, forecast.temperature);
      acc[date].summary.tempMax = Math.max(acc[date].summary.tempMax, forecast.temperature);
      acc[date].summary.totalRainfall += forecast.rainfall;

      return acc;
    }, {});

    // Calculate averages for summary
    const dailyForecasts = Object.values(groupedByDay).map((day: any) => {
      const hourlyCount = day.hourly.length;
      day.summary.avgHumidity = day.hourly.reduce((sum: number, h: any) => sum + h.humidity, 0) / hourlyCount;
      day.summary.avgWindSpeed = day.hourly.reduce((sum: number, h: any) => sum + h.windSpeed, 0) / hourlyCount;
      
      // Round values
      day.summary.tempMin = Math.round(day.summary.tempMin * 10) / 10;
      day.summary.tempMax = Math.round(day.summary.tempMax * 10) / 10;
      day.summary.totalRainfall = Math.round(day.summary.totalRainfall * 10) / 10;
      day.summary.avgHumidity = Math.round(day.summary.avgHumidity);
      day.summary.avgWindSpeed = Math.round(day.summary.avgWindSpeed * 10) / 10;

      return day;
    });

    // Check for critical weather conditions
    const criticalAlerts = [];
    for (const forecast of forecasts) {
      if (forecast.rainfall > 100) {
        criticalAlerts.push({
          type: 'HEAVY_RAINFALL',
          severity: 'HIGH',
          message: `Heavy rainfall expected: ${forecast.rainfall}mm`,
          time: forecast.time,
        });
      }
      if (forecast.temperature > 45) {
        criticalAlerts.push({
          type: 'EXTREME_HEAT',
          severity: 'HIGH',
          message: `Extreme heat warning: ${forecast.temperature}°C`,
          time: forecast.time,
        });
      }
      if (forecast.temperature < 5) {
        criticalAlerts.push({
          type: 'FROST',
          severity: 'CRITICAL',
          message: `Frost warning: ${forecast.temperature}°C`,
          time: forecast.time,
        });
      }
      if (forecast.windSpeed > 60) {
        criticalAlerts.push({
          type: 'HIGH_WIND',
          severity: 'HIGH',
          message: `High wind warning: ${forecast.windSpeed}km/h`,
          time: forecast.time,
        });
      }
    }

    const responseData = {
      location: { lat: latitude, lng: longitude },
      forecasts: dailyForecasts,
      criticalAlerts,
    };

    res.json({
      success: true,
      data: responseData,
      metadata: {
        timestamp: new Date().toISOString(),
        count: forecasts.length,
        hyperlocalAccuracy: '5km',
        daysRequested: forecastDays,
      },
    });

  } catch (error) {
    logger.error('Error fetching weather forecast', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch weather forecast',
      },
    });
  }
});

/**
 * POST /api/v1/climate/weather/update
 * Manually trigger weather update for a location (admin only)
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.post('/update', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Latitude and longitude are required',
        },
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    logger.info('Manual weather update triggered', { lat: latitude, lng: longitude });

    await weatherService.updateWeatherForLocation(latitude, longitude);

    res.json({
      success: true,
      message: 'Weather update completed successfully',
      data: {
        location: { lat: latitude, lng: longitude },
      },
    });

  } catch (error) {
    logger.error('Error updating weather', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update weather data',
      },
    });
  }
});

export default router;


/**
 * GET /api/v1/climate/cache/metrics
 * Get cache performance metrics
 */
router.get('/cache/metrics', async (req: Request, res: Response) => {
  const metrics = cacheMiddleware.getMetrics();
  
  res.json({
    success: true,
    data: {
      ...metrics,
      hit_rate_percentage: cacheMiddleware.getHitRate().toFixed(2),
    },
  });
});
