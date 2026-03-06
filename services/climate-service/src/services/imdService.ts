import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import redis from '../config/redis';

interface WeatherData {
  location: {
    lat: number;
    lng: number;
  };
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  timestamp: Date;
}

interface WeatherForecast {
  time: Date;
  location: {
    lat: number;
    lng: number;
  };
  temperature: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  source: string;
}

class IMDService {
  private client: AxiosInstance;
  private readonly CACHE_PREFIX = 'imd:weather:';
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor() {
    this.client = axios.create({
      baseURL: config.imd.apiUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${config.imd.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('IMD API request', { 
          url: config.url,
          method: config.method 
        });
        return config;
      },
      (error) => {
        logger.error('IMD API request error', { 
          error: error.message 
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.info('IMD API response', { 
          status: response.status,
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('IMD API response error', { 
          status: error.response?.status,
          message: error.message,
          url: error.config?.url 
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch weather forecast from IMD API with retry logic
   */
  async fetchWeatherForecast(
    lat: number, 
    lng: number, 
    days: number = 7
  ): Promise<WeatherForecast[]> {
    const cacheKey = `${this.CACHE_PREFIX}${lat},${lng}:${days}`;
    
    // Check cache first
    const cached = await redis.getJSON<WeatherForecast[]>(cacheKey);
    if (cached) {
      logger.info('Weather forecast retrieved from cache', { lat, lng, days });
      return cached;
    }

    // Fetch from API with retry
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`Fetching weather forecast from IMD (attempt ${attempt})`, { 
          lat, lng, days 
        });

        const response = await this.client.get('/forecast', {
          params: {
            lat,
            lon: lng,
            days,
            format: 'json',
          },
        });

        const forecasts = this.parseIMDResponse(response.data, lat, lng);
        
        // Cache the result
        await redis.setJSON(cacheKey, forecasts, config.cache.weatherTTL);
        
        logger.info('Weather forecast fetched successfully', { 
          lat, lng, days, count: forecasts.length 
        });
        
        return forecasts;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`IMD API fetch failed (attempt ${attempt}/${this.RETRY_ATTEMPTS})`, {
          error: lastError.message,
          lat,
          lng,
        });

        if (attempt < this.RETRY_ATTEMPTS) {
          await this.delay(this.RETRY_DELAY * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    logger.error('Failed to fetch weather forecast after all retries', {
      lat,
      lng,
      error: lastError?.message,
    });

    throw new Error(`Failed to fetch weather data: ${lastError?.message}`);
  }

  /**
   * Parse IMD API response into standardized format
   */
  private parseIMDResponse(data: any, lat: number, lng: number): WeatherForecast[] {
    const forecasts: WeatherForecast[] = [];

    try {
      // IMD API response structure (adjust based on actual API)
      const forecastData = data.forecast || data.data || [];

      for (const item of forecastData) {
        forecasts.push({
          time: new Date(item.time || item.timestamp),
          location: { lat, lng },
          temperature: parseFloat(item.temperature || item.temp || 0),
          rainfall: parseFloat(item.rainfall || item.rain || 0),
          humidity: parseFloat(item.humidity || 0),
          windSpeed: parseFloat(item.wind_speed || item.windSpeed || 0),
          source: 'IMD',
        });
      }

      return forecasts;
    } catch (error) {
      logger.error('Error parsing IMD response', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Failed to parse IMD response');
    }
  }

  /**
   * Check if critical weather conditions exist
   */
  checkCriticalWeather(forecast: WeatherForecast): {
    isCritical: boolean;
    alerts: string[];
  } {
    const alerts: string[] = [];
    let isCritical = false;

    if (forecast.rainfall > config.thresholds.criticalRainfall) {
      alerts.push(`Heavy rainfall warning: ${forecast.rainfall}mm/day`);
      isCritical = true;
    }

    if (forecast.temperature > config.thresholds.criticalTempHigh) {
      alerts.push(`Extreme heat warning: ${forecast.temperature}°C`);
      isCritical = true;
    }

    if (forecast.temperature < config.thresholds.criticalTempLow) {
      alerts.push(`Frost warning: ${forecast.temperature}°C`);
      isCritical = true;
    }

    if (forecast.windSpeed > config.thresholds.criticalWindSpeed) {
      alerts.push(`High wind warning: ${forecast.windSpeed} km/h`);
      isCritical = true;
    }

    return { isCritical, alerts };
  }

  /**
   * Utility function for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test IMD API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a sample location (Delhi)
      await this.fetchWeatherForecast(28.6139, 77.2090, 1);
      logger.info('IMD API connection test successful');
      return true;
    } catch (error) {
      logger.error('IMD API connection test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}

export default new IMDService();
