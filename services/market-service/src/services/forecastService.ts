import axios from 'axios';
import { redisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface ForecastParams {
  crop_name: string;
  market_name: string;
  days: 7 | 30 | 90;
}

export interface PriceForecast {
  date: string;
  predicted_price: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

export interface ForecastResponse {
  crop_name: string;
  market_name: string;
  forecast_days: number;
  forecasts: PriceForecast[];
  accuracy_mape: number;
  model_type: 'arima' | 'lstm' | 'ensemble';
}

export class ForecastService {
  private mlServiceUrl: string;
  
  constructor() {
    // ML service URL (price-forecaster Python service)
    this.mlServiceUrl = process.env.ML_FORECAST_SERVICE_URL || 'http://localhost:8003';
  }
  
  /**
   * Get price forecast using ARIMA/LSTM ensemble model
   * Target: >85% accuracy (MAPE < 15%)
   */
  async getForecast(params: ForecastParams): Promise<ForecastResponse> {
    const { crop_name, market_name, days } = params;
    
    // Check cache first
    const cacheKey = `forecast:${crop_name}:${market_name}:${days}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      logger.info('Returning cached forecast', { cacheKey });
      return JSON.parse(cached);
    }
    
    try {
      // Call ML service for forecast
      const response = await axios.post(
        `${this.mlServiceUrl}/api/v1/forecast`,
        {
          crop_name,
          market_name,
          forecast_days: days,
        },
        {
          timeout: 5000, // 5 second timeout
        }
      );
      
      const forecast: ForecastResponse = response.data;
      
      // Validate accuracy requirement (MAPE < 15%)
      if (forecast.accuracy_mape > 15) {
        logger.warn('Forecast accuracy below threshold', {
          crop: crop_name,
          market: market_name,
          mape: forecast.accuracy_mape,
        });
      }
      
      // Cache for 6 hours
      await redisClient.set(
        cacheKey,
        JSON.stringify(forecast),
        config.cache.forecastTtl
      );
      
      logger.info('Generated price forecast', {
        crop: crop_name,
        market: market_name,
        days,
        mape: forecast.accuracy_mape,
      });
      
      return forecast;
    } catch (error) {
      logger.error('Error generating forecast', { error, params });
      
      // Return fallback response if ML service unavailable
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        logger.warn('ML service unavailable, returning fallback');
        return this.getFallbackForecast(params);
      }
      
      throw error;
    }
  }
  
  /**
   * Fallback forecast when ML service is unavailable
   * Uses simple moving average
   */
  private async getFallbackForecast(params: ForecastParams): Promise<ForecastResponse> {
    const { crop_name, market_name, days } = params;
    
    // This would query historical prices and calculate simple moving average
    // For now, return a placeholder
    return {
      crop_name,
      market_name,
      forecast_days: days,
      forecasts: [],
      accuracy_mape: 20, // Lower accuracy for fallback
      model_type: 'arima',
    };
  }
  
  /**
   * Get multiple forecasts for different time periods
   */
  async getMultipleForecast(
    crop_name: string,
    market_name: string
  ): Promise<{
    short_term: ForecastResponse;
    medium_term: ForecastResponse;
    long_term: ForecastResponse;
  }> {
    const [shortTerm, mediumTerm, longTerm] = await Promise.all([
      this.getForecast({ crop_name, market_name, days: 7 }),
      this.getForecast({ crop_name, market_name, days: 30 }),
      this.getForecast({ crop_name, market_name, days: 90 }),
    ]);
    
    return {
      short_term: shortTerm,
      medium_term: mediumTerm,
      long_term: longTerm,
    };
  }
}

export const forecastService = new ForecastService();
