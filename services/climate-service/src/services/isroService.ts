import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import redis from '../config/redis';

interface SatelliteData {
  location: {
    lat: number;
    lng: number;
  };
  soilMoisture?: number;
  vegetation?: number;
  cloudCover?: number;
  timestamp: Date;
  source: string;
}

class ISROService {
  private client: AxiosInstance;
  private readonly CACHE_PREFIX = 'isro:satellite:';
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000;

  constructor() {
    this.client = axios.create({
      baseURL: config.isro.apiUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${config.isro.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info('ISRO MOSDAC API request', { 
          url: config.url,
          method: config.method 
        });
        return config;
      },
      (error) => {
        logger.error('ISRO MOSDAC API request error', { 
          error: error.message 
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info('ISRO MOSDAC API response', { 
          status: response.status,
          url: response.config.url 
        });
        return response;
      },
      (error) => {
        logger.error('ISRO MOSDAC API response error', { 
          status: error.response?.status,
          message: error.message,
          url: error.config?.url 
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch satellite data from ISRO MOSDAC with retry logic
   */
  async fetchSatelliteData(
    lat: number, 
    lng: number
  ): Promise<SatelliteData | null> {
    const cacheKey = `${this.CACHE_PREFIX}${lat},${lng}`;
    
    // Check cache first (24 hour TTL for satellite data)
    const cached = await redis.getJSON<SatelliteData>(cacheKey);
    if (cached) {
      logger.info('Satellite data retrieved from cache', { lat, lng });
      return cached;
    }

    // Fetch from API with retry
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`Fetching satellite data from ISRO (attempt ${attempt})`, { 
          lat, lng 
        });

        const response = await this.client.get('/satellite-data', {
          params: {
            lat,
            lon: lng,
            format: 'json',
          },
        });

        const satelliteData = this.parseISROResponse(response.data, lat, lng);
        
        // Cache the result (24 hours)
        await redis.setJSON(cacheKey, satelliteData, 86400);
        
        logger.info('Satellite data fetched successfully', { lat, lng });
        
        return satelliteData;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`ISRO API fetch failed (attempt ${attempt}/${this.RETRY_ATTEMPTS})`, {
          error: lastError.message,
          lat,
          lng,
        });

        if (attempt < this.RETRY_ATTEMPTS) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    // All retries failed - return null instead of throwing
    logger.error('Failed to fetch satellite data after all retries', {
      lat,
      lng,
      error: lastError?.message,
    });

    return null;
  }

  /**
   * Parse ISRO MOSDAC API response
   */
  private parseISROResponse(data: any, lat: number, lng: number): SatelliteData {
    try {
      return {
        location: { lat, lng },
        soilMoisture: data.soil_moisture ? parseFloat(data.soil_moisture) : undefined,
        vegetation: data.ndvi ? parseFloat(data.ndvi) : undefined,
        cloudCover: data.cloud_cover ? parseFloat(data.cloud_cover) : undefined,
        timestamp: new Date(data.timestamp || Date.now()),
        source: 'ISRO_MOSDAC',
      };
    } catch (error) {
      logger.error('Error parsing ISRO response', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new Error('Failed to parse ISRO response');
    }
  }

  /**
   * Utility function for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test ISRO API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a sample location
      await this.fetchSatelliteData(28.6139, 77.2090);
      logger.info('ISRO MOSDAC API connection test successful');
      return true;
    } catch (error) {
      logger.error('ISRO MOSDAC API connection test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}

export default new ISROService();
