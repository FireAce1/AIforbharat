import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import {
  ExternalDataService,
  DataValidationResult,
} from '../../../shared/external-data/externalDataService';

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

interface WeatherForecastArray extends Array<WeatherForecast> {}

/**
 * IMD Service with fallback mechanisms and data validation
 */
class IMDServiceWithFallback extends ExternalDataService<WeatherForecastArray> {
  protected serviceName = 'IMD';
  protected cachePrefix = 'imd:weather:';
  protected cacheTTL = 21600; // 6 hours
  protected maxStaleTime = 86400; // 24 hours - max time to use stale weather data

  private client: AxiosInstance;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  constructor() {
    super();
    this.client = axios.create({
      baseURL: config.imd.apiUrl,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${config.imd.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for logging
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      config => {
        logger.info('IMD API request', {
          url: config.url,
          method: config.method,
        });
        return config;
      },
      error => {
        logger.error('IMD API request error', {
          error: error.message,
        });
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      response => {
        logger.info('IMD API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      error => {
        logger.error('IMD API response error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Fetch weather forecast with automatic fallback
   */
  async fetchWeatherForecast(
    lat: number,
    lng: number,
    days: number = 7,
  ) {
    const cacheKey = `${lat},${lng}:${days}`;

    return this.fetchWithFallback(cacheKey, async () => {
      return await this.fetchFromAPI(lat, lng, days);
    });
  }

  /**
   * Fetch from IMD API with retry logic
   */
  private async fetchFromAPI(
    lat: number,
    lng: number,
    days: number,
  ): Promise<WeatherForecastArray> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`Fetching weather forecast from IMD (attempt ${attempt})`, {
          lat,
          lng,
          days,
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

        logger.info('Weather forecast fetched successfully', {
          lat,
          lng,
          days,
          count: forecasts.length,
        });

        return forecasts;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(
          `IMD API fetch failed (attempt ${attempt}/${this.RETRY_ATTEMPTS})`,
          {
            error: lastError.message,
            lat,
            lng,
          },
        );

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
  private parseIMDResponse(
    data: any,
    lat: number,
    lng: number,
  ): WeatherForecastArray {
    try {
      const forecastData = data.forecast || data.data || [];
      const forecasts: WeatherForecastArray = [];

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
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to parse IMD response');
    }
  }

  /**
   * Validate weather forecast data
   */
  protected async validateData(
    data: WeatherForecastArray,
  ): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if data is empty
    if (!data || data.length === 0) {
      errors.push('Weather forecast data is empty');
      return { isValid: false, errors, warnings };
    }

    // Validate each forecast entry
    for (let i = 0; i < data.length; i++) {
      const forecast = data[i];

      // Check required fields
      if (!forecast.time) {
        errors.push(`Forecast ${i}: Missing time field`);
      }

      if (!forecast.location || !forecast.location.lat || !forecast.location.lng) {
        errors.push(`Forecast ${i}: Missing or invalid location`);
      }

      // Validate temperature range (-50°C to 60°C)
      if (
        forecast.temperature < -50 ||
        forecast.temperature > 60 ||
        isNaN(forecast.temperature)
      ) {
        warnings.push(
          `Forecast ${i}: Temperature out of expected range: ${forecast.temperature}°C`,
        );
      }

      // Validate rainfall (0 to 500mm/day)
      if (forecast.rainfall < 0 || forecast.rainfall > 500 || isNaN(forecast.rainfall)) {
        warnings.push(
          `Forecast ${i}: Rainfall out of expected range: ${forecast.rainfall}mm`,
        );
      }

      // Validate humidity (0-100%)
      if (forecast.humidity < 0 || forecast.humidity > 100 || isNaN(forecast.humidity)) {
        warnings.push(
          `Forecast ${i}: Humidity out of expected range: ${forecast.humidity}%`,
        );
      }

      // Validate wind speed (0-200 km/h)
      if (forecast.windSpeed < 0 || forecast.windSpeed > 200 || isNaN(forecast.windSpeed)) {
        warnings.push(
          `Forecast ${i}: Wind speed out of expected range: ${forecast.windSpeed} km/h`,
        );
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.error('Weather forecast validation failed', {
        errors,
        warnings,
      });
    } else if (warnings.length > 0) {
      logger.warn('Weather forecast validation warnings', {
        warnings,
      });
    }

    return { isValid, errors, warnings };
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
      await this.fetchWeatherForecast(28.6139, 77.209, 1);
      logger.info('IMD API connection test successful');
      return true;
    } catch (error) {
      logger.error('IMD API connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export default new IMDServiceWithFallback();
