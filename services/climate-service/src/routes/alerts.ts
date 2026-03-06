import { Router, Request, Response } from 'express';
import weatherService from '../services/weatherService';
import alertService from '../services/alertService';
import database from '../config/database';
import logger from '../utils/logger';
import { apiRateLimiter } from '../../../shared/middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/climate/alerts/send
 * Send immediate SMS alerts to affected farmers for critical weather conditions
 * Thresholds: rainfall >100mm/day, temp >45°C, frost <5°C, wind >60km/h
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.post('/send', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 5000 } = req.body;

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

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseInt(radius, 10);

    logger.info('Checking critical weather alerts', { 
      lat: latitude, 
      lng: longitude,
      radius: searchRadius,
    });

    // Get weather forecast for the location
    const forecasts = await weatherService.getWeatherForecast(latitude, longitude, 1);

    if (forecasts.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No weather forecast available for this location',
        },
      });
    }

    // Check for critical weather conditions
    const criticalAlerts = [];
    
    for (const forecast of forecasts) {
      // Heavy rainfall: >100mm/day
      if (forecast.rainfall > 100) {
        criticalAlerts.push({
          type: 'HEAVY_RAINFALL' as const,
          severity: 'HIGH' as const,
          message: `${forecast.rainfall}mm`,
          location: forecast.location,
        });
      }

      // Extreme heat: >45°C
      if (forecast.temperature > 45) {
        criticalAlerts.push({
          type: 'EXTREME_HEAT' as const,
          severity: 'HIGH' as const,
          message: `${forecast.temperature}°C`,
          location: forecast.location,
        });
      }

      // Frost: <5°C
      if (forecast.temperature < 5) {
        criticalAlerts.push({
          type: 'FROST' as const,
          severity: 'CRITICAL' as const,
          message: `${forecast.temperature}°C`,
          location: forecast.location,
        });
      }

      // High wind: >60km/h
      if (forecast.windSpeed > 60) {
        criticalAlerts.push({
          type: 'HIGH_WIND' as const,
          severity: 'HIGH' as const,
          message: `${forecast.windSpeed}km/h`,
          location: forecast.location,
        });
      }
    }

    if (criticalAlerts.length === 0) {
      return res.json({
        success: true,
        message: 'No critical weather conditions detected',
        data: {
          alertsSent: 0,
          affectedFarmers: 0,
        },
      });
    }

    // Find affected farmers within radius
    const farmersQuery = `
      SELECT DISTINCT
        u.id::text as user_id,
        u.phone,
        u.name
      FROM users u
      INNER JOIN farms f ON f.user_id = u.id
      WHERE ST_DWithin(
        f.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    `;

    const farmersResult = await database.query(farmersQuery, [
      longitude,
      latitude,
      searchRadius,
    ]);

    const affectedFarmers = farmersResult.rows.map((row: any) => ({
      userId: row.user_id,
      phone: row.phone,
      name: row.name,
    }));

    if (affectedFarmers.length === 0) {
      return res.json({
        success: true,
        message: 'No farmers found in the affected area',
        data: {
          alertsSent: 0,
          affectedFarmers: 0,
          criticalConditions: criticalAlerts.length,
        },
      });
    }

    // Send alerts to all affected farmers
    const alertResults = [];
    
    for (const alert of criticalAlerts) {
      const formattedMessage = alertService.formatAlertMessage(alert);
      const result = await alertService.sendWeatherAlerts(affectedFarmers, {
        ...alert,
        message: formattedMessage,
      });
      
      alertResults.push({
        alertType: alert.type,
        sent: result.sent,
        failed: result.failed,
      });
    }

    const totalSent = alertResults.reduce((sum, r) => sum + r.sent, 0);
    const totalFailed = alertResults.reduce((sum, r) => sum + r.failed, 0);

    logger.info('Critical weather alerts sent', {
      location: { lat: latitude, lng: longitude },
      affectedFarmers: affectedFarmers.length,
      alertsSent: totalSent,
      alertsFailed: totalFailed,
    });

    res.json({
      success: true,
      message: 'Weather alerts sent successfully',
      data: {
        location: { lat: latitude, lng: longitude },
        affectedFarmers: affectedFarmers.length,
        criticalConditions: criticalAlerts.length,
        alertsSent: totalSent,
        alertsFailed: totalFailed,
        details: alertResults,
      },
    });

  } catch (error) {
    logger.error('Error sending weather alerts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_SEND_FAILED',
        message: 'Failed to send weather alerts',
      },
    });
  }
});

/**
 * GET /api/v1/climate/alerts/check
 * Check for critical weather conditions without sending alerts
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/check', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

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

    // Get weather forecast for the location
    const forecasts = await weatherService.getWeatherForecast(latitude, longitude, 1);

    if (forecasts.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA',
          message: 'No weather forecast available for this location',
        },
      });
    }

    // Check for critical weather conditions
    const criticalAlerts = [];
    
    for (const forecast of forecasts) {
      if (forecast.rainfall > 100) {
        criticalAlerts.push({
          type: 'HEAVY_RAINFALL',
          severity: 'HIGH',
          threshold: '100mm/day',
          actual: `${forecast.rainfall}mm`,
          message: `Heavy rainfall expected: ${forecast.rainfall}mm`,
        });
      }

      if (forecast.temperature > 45) {
        criticalAlerts.push({
          type: 'EXTREME_HEAT',
          severity: 'HIGH',
          threshold: '45°C',
          actual: `${forecast.temperature}°C`,
          message: `Extreme heat warning: ${forecast.temperature}°C`,
        });
      }

      if (forecast.temperature < 5) {
        criticalAlerts.push({
          type: 'FROST',
          severity: 'CRITICAL',
          threshold: '5°C',
          actual: `${forecast.temperature}°C`,
          message: `Frost warning: ${forecast.temperature}°C`,
        });
      }

      if (forecast.windSpeed > 60) {
        criticalAlerts.push({
          type: 'HIGH_WIND',
          severity: 'HIGH',
          threshold: '60km/h',
          actual: `${forecast.windSpeed}km/h`,
          message: `High wind warning: ${forecast.windSpeed}km/h`,
        });
      }
    }

    res.json({
      success: true,
      data: {
        location: { lat: latitude, lng: longitude },
        hasCriticalConditions: criticalAlerts.length > 0,
        criticalAlerts,
        thresholds: {
          rainfall: '100mm/day',
          extremeHeat: '45°C',
          frost: '5°C',
          wind: '60km/h',
        },
      },
    });

  } catch (error) {
    logger.error('Error checking weather alerts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_CHECK_FAILED',
        message: 'Failed to check weather alerts',
      },
    });
  }
});

export default router;
