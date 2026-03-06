import { Router, Request, Response } from 'express';
import database from '../config/database';
import redis from '../config/redis';
import logger from '../utils/logger';
import CacheMiddleware, { CachePresets } from '../../../shared/middleware/cacheMiddleware';
import { apiRateLimiter } from '../../../shared/middleware/rateLimiter';
import {
  calculateIrrigationNeed,
  trackWaterSavings,
  GrowthStage,
  WeatherData,
  IrrigationRecommendation,
} from '../services/waterAdvisoryService';

const router = Router();

// Initialize cache middleware
const cacheMiddleware = new CacheMiddleware(redis.getClient(), 'climate');

/**
 * GET /api/v1/climate/water/advisory
 * Get irrigation recommendation for a specific farm and crop
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/advisory', apiRateLimiter, cacheMiddleware.cache(CachePresets.WEATHER), async (req: Request, res: Response) => {
  try {
    const { farm_id, crop_id } = req.query;

    if (!farm_id || !crop_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'farm_id and crop_id are required',
        },
      });
    }

    // Fetch farm and crop details
    const farmResult = await database.query(
      'SELECT location, soil_type FROM farms WHERE id = $1',
      [farm_id]
    );

    if (farmResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FARM_NOT_FOUND',
          message: 'Farm not found',
        },
      });
    }

    const cropResult = await database.query(
      'SELECT crop_name, sowing_date, status FROM crops WHERE id = $1',
      [crop_id]
    );

    if (cropResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CROP_NOT_FOUND',
          message: 'Crop not found',
        },
      });
    }

    const farm = farmResult.rows[0];
    const crop = cropResult.rows[0];

    // Determine growth stage based on days since sowing
    const sowingDate = new Date(crop.sowing_date);
    const daysSinceSowing = Math.floor(
      (Date.now() - sowingDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let growthStage: GrowthStage;
    if (daysSinceSowing < 30) {
      growthStage = 'initial';
    } else if (daysSinceSowing < 90) {
      growthStage = 'mid';
    } else {
      growthStage = 'late';
    }

    // Fetch latest weather forecast
    const weatherResult = await database.query(
      `SELECT temperature, rainfall, humidity, wind_speed, solar_radiation
       FROM weather_forecasts
       WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
       ORDER BY time DESC
       LIMIT 1`,
      [farm.location.coordinates[0], farm.location.coordinates[1]]
    );

    if (weatherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WEATHER_DATA_NOT_FOUND',
          message: 'Weather data not available for this location',
        },
      });
    }

    const weatherRow = weatherResult.rows[0];
    const weather: WeatherData = {
      temp_max: weatherRow.temperature + 5, // Approximate max temp
      temp_min: weatherRow.temperature - 5, // Approximate min temp
      humidity: weatherRow.humidity,
      wind_speed: weatherRow.wind_speed,
      solar_radiation: weatherRow.solar_radiation || 20, // Default if not available
    };

    // Get recent rainfall (last 7 days)
    const rainfallResult = await database.query(
      `SELECT COALESCE(SUM(rainfall), 0) as total_rainfall
       FROM weather_forecasts
       WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
       AND time >= NOW() - INTERVAL '7 days'`,
      [farm.location.coordinates[0], farm.location.coordinates[1]]
    );

    const recentRainfall = parseFloat(rainfallResult.rows[0].total_rainfall);

    // Estimate soil moisture based on soil type and recent rainfall
    const soilMoistureMap: Record<string, number> = {
      Alluvial: 30,
      Black: 40,
      Red: 25,
      Laterite: 20,
      Desert: 10,
      Mountain: 35,
    };
    const baseSoilMoisture = soilMoistureMap[farm.soil_type] || 25;
    const soilMoisture = Math.min(baseSoilMoisture + recentRainfall * 0.3, 100);

    // Calculate irrigation recommendation
    const recommendation = calculateIrrigationNeed(
      crop.crop_name,
      growthStage,
      soilMoisture,
      weather,
      recentRainfall
    );

    // Store recommendation in database
    await database.query(
      `INSERT INTO irrigation_recommendations 
       (farm_id, crop_id, recommendation_date, should_irrigate, water_amount_mm, 
        timing, water_saved_mm, calculation_method, reason, etc, effective_rainfall)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (farm_id, recommendation_date) 
       DO UPDATE SET 
         should_irrigate = EXCLUDED.should_irrigate,
         water_amount_mm = EXCLUDED.water_amount_mm,
         timing = EXCLUDED.timing,
         water_saved_mm = EXCLUDED.water_saved_mm,
         reason = EXCLUDED.reason,
         etc = EXCLUDED.etc,
         effective_rainfall = EXCLUDED.effective_rainfall`,
      [
        farm_id,
        crop_id,
        recommendation.irrigate,
        recommendation.amount_mm,
        recommendation.timing,
        recommendation.water_saved_mm,
        recommendation.calculation_method,
        recommendation.reason,
        recommendation.etc,
        recommendation.effective_rainfall,
      ]
    );

    // Add unique constraint to migration if needed
    const responseData = {
      farm_id,
      crop_id,
      crop_name: crop.crop_name,
      growth_stage: growthStage,
      days_since_sowing: daysSinceSowing,
      recommendation,
      weather_summary: {
        temperature: weatherRow.temperature,
        recent_rainfall_mm: Math.round(recentRainfall * 100) / 100,
        humidity: weatherRow.humidity,
      },
    };

    logger.info('Generated water advisory', { farm_id, crop_id, recommendation });

    res.json({
      success: true,
      data: responseData,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error generating water advisory', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate water advisory',
      },
    });
  }
});

/**
 * GET /api/v1/climate/water/savings
 * Get cumulative water savings for a farm
 * 
 * Rate limit: 1000 requests per hour per user
 */
router.get('/savings', apiRateLimiter, cacheMiddleware.cache({ ttl: 3600 }), async (req: Request, res: Response) => {
  try {
    const { farm_id, period_days = 30 } = req.query;

    if (!farm_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'farm_id is required',
        },
      });
    }

    const days = parseInt(period_days as string, 10);

    // Fetch recommendations for the period
    const result = await database.query(
      `SELECT should_irrigate, water_amount_mm, water_saved_mm, recommendation_date
       FROM irrigation_recommendations
       WHERE farm_id = $1
       AND recommendation_date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY recommendation_date DESC`,
      [farm_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          farm_id,
          period_days: days,
          recommendations_count: 0,
          savings: {
            total_water_saved_mm: 0,
            traditional_usage_mm: 0,
            optimized_usage_mm: 0,
            savings_percentage: 0,
          },
        },
      });
    }

    // Convert database rows to recommendation format
    const recommendations: IrrigationRecommendation[] = result.rows.map((row: any) => ({
      irrigate: row.should_irrigate,
      amount_mm: parseFloat(row.water_amount_mm) || 0,
      timing: 'morning' as const,
      reason: '',
      water_saved_mm: parseFloat(row.water_saved_mm) || 0,
      etc: 0,
      effective_rainfall: 0,
      calculation_method: 'FAO-56',
    }));

    // Calculate cumulative savings
    const savings = trackWaterSavings(recommendations);

    // Store in tracking table
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    const periodEnd = new Date();

    await database.query(
      `INSERT INTO water_savings_tracking 
       (farm_id, period_start, period_end, total_water_saved_mm, 
        traditional_usage_mm, optimized_usage_mm, savings_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        farm_id,
        periodStart,
        periodEnd,
        savings.total_water_saved_mm,
        savings.traditional_usage_mm,
        savings.optimized_usage_mm,
        savings.savings_percentage,
      ]
    );

    logger.info('Calculated water savings', { farm_id, period_days: days, savings });

    res.json({
      success: true,
      data: {
        farm_id,
        period_days: days,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        recommendations_count: recommendations.length,
        savings,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error calculating water savings', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to calculate water savings',
      },
    });
  }
});

export default router;
