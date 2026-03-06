import database from '../config/database';
import imdService from './imdService';
import isroService from './isroService';
import logger from '../utils/logger';

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

class WeatherService {
  /**
   * Store weather forecasts in TimescaleDB hypertable
   */
  async storeWeatherForecasts(forecasts: WeatherForecast[]): Promise<void> {
    if (forecasts.length === 0) {
      logger.warn('No forecasts to store');
      return;
    }

    const client = await database.getClient();
    
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO weather_forecasts (
          time, location, temperature, rainfall, humidity, wind_speed, source
        ) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8)
        ON CONFLICT (time, location) 
        DO UPDATE SET
          temperature = EXCLUDED.temperature,
          rainfall = EXCLUDED.rainfall,
          humidity = EXCLUDED.humidity,
          wind_speed = EXCLUDED.wind_speed,
          source = EXCLUDED.source
      `;

      for (const forecast of forecasts) {
        await client.query(insertQuery, [
          forecast.time,
          forecast.location.lng,
          forecast.location.lat,
          forecast.temperature,
          forecast.rainfall,
          forecast.humidity,
          forecast.windSpeed,
          forecast.source,
        ]);
      }

      await client.query('COMMIT');
      
      logger.info('Weather forecasts stored successfully', { 
        count: forecasts.length 
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error storing weather forecasts', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch and store weather data for a location
   */
  async updateWeatherForLocation(lat: number, lng: number): Promise<void> {
    try {
      logger.info('Updating weather for location', { lat, lng });

      // Fetch 7-day forecast from IMD
      const forecasts = await imdService.fetchWeatherForecast(lat, lng, 7);
      
      // Store in database
      await this.storeWeatherForecasts(forecasts);

      // Optionally fetch satellite data from ISRO
      const satelliteData = await isroService.fetchSatelliteData(lat, lng);
      if (satelliteData) {
        logger.info('Satellite data fetched', { lat, lng });
        // Store satellite data if needed
      }

      logger.info('Weather update completed', { lat, lng });
    } catch (error) {
      logger.error('Error updating weather for location', { 
        lat, 
        lng,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get weather forecast from database
   */
  async getWeatherForecast(
    lat: number, 
    lng: number, 
    days: number = 7
  ): Promise<WeatherForecast[]> {
    try {
      const query = `
        SELECT 
          time,
          ST_X(location::geometry) as lng,
          ST_Y(location::geometry) as lat,
          temperature,
          rainfall,
          humidity,
          wind_speed,
          source
        FROM weather_forecasts
        WHERE ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          5000  -- 5km radius for hyperlocal accuracy
        )
        AND time >= NOW()
        AND time <= NOW() + INTERVAL '${days} days'
        ORDER BY time ASC
      `;

      const result = await database.query(query, [lng, lat]);

      return result.rows.map((row: any) => ({
        time: row.time,
        location: {
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
        },
        temperature: parseFloat(row.temperature),
        rainfall: parseFloat(row.rainfall),
        humidity: parseFloat(row.humidity),
        windSpeed: parseFloat(row.wind_speed),
        source: row.source,
      }));
    } catch (error) {
      logger.error('Error fetching weather forecast', { 
        lat, 
        lng,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Check for critical weather conditions and get affected farms
   */
  async checkCriticalWeatherAlerts(): Promise<{
    location: { lat: number; lng: number };
    alerts: string[];
    affectedFarms: string[];
  }[]> {
    try {
      // Get all upcoming forecasts
      const query = `
        SELECT DISTINCT ON (location)
          time,
          ST_X(location::geometry) as lng,
          ST_Y(location::geometry) as lat,
          temperature,
          rainfall,
          humidity,
          wind_speed
        FROM weather_forecasts
        WHERE time >= NOW()
        AND time <= NOW() + INTERVAL '24 hours'
        ORDER BY location, time ASC
      `;

      const result = await database.query(query);
      const criticalAlerts = [];

      for (const row of result.rows) {
        const forecast = {
          time: row.time,
          location: {
            lat: parseFloat(row.lat),
            lng: parseFloat(row.lng),
          },
          temperature: parseFloat(row.temperature),
          rainfall: parseFloat(row.rainfall),
          humidity: parseFloat(row.humidity),
          windSpeed: parseFloat(row.wind_speed),
          source: 'IMD',
        };

        const { isCritical, alerts } = imdService.checkCriticalWeather(forecast);

        if (isCritical) {
          // Find affected farms within 5km
          const farmsQuery = `
            SELECT id::text
            FROM farms
            WHERE ST_DWithin(
              location,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              5000
            )
          `;

          const farmsResult = await database.query(farmsQuery, [
            forecast.location.lng,
            forecast.location.lat,
          ]);

          criticalAlerts.push({
            location: forecast.location,
            alerts,
            affectedFarms: farmsResult.rows.map((f: any) => f.id),
          });
        }
      }

      return criticalAlerts;
    } catch (error) {
      logger.error('Error checking critical weather alerts', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
}

export default new WeatherService();
