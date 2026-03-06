import { database } from '../config/database';
import { redisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface MarketPrice {
  time: Date;
  crop_name: string;
  market_name: string;
  location: { lat: number; lng: number };
  price_per_kg: number;
  quantity_traded: number;
}

export interface PriceQueryParams {
  crop_name: string;
  latitude: number;
  longitude: number;
  radius_km?: number;
  limit?: number;
}

export interface PriceTrend {
  crop_name: string;
  market_name: string;
  current_price: number;
  previous_price: number;
  trend: 'up' | 'down' | 'stable';
  change_percentage: number;
}

export class PriceService {
  /**
   * Get current market prices for a crop near a location
   * Uses PostGIS ST_DWithin for geospatial queries
   */
  async getPrices(params: PriceQueryParams): Promise<MarketPrice[]> {
    const { crop_name, latitude, longitude, radius_km = 50, limit = 5 } = params;
    
    // Check cache first
    const cacheKey = `prices:${crop_name}:${latitude}:${longitude}:${radius_km}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      logger.info('Returning cached prices', { cacheKey });
      return JSON.parse(cached);
    }
    
    // Query database with geospatial filter
    const query = `
      SELECT 
        time,
        crop_name,
        market_name,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude,
        price_per_kg,
        quantity_traded
      FROM market_prices
      WHERE crop_name = $1
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
        AND time >= NOW() - INTERVAL '7 days'
      ORDER BY 
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        ) ASC,
        time DESC
      LIMIT $5
    `;
    
    const values = [crop_name, longitude, latitude, radius_km * 1000, limit];
    
    try {
      const result = await database.query(query, values);
      
      const prices: MarketPrice[] = result.rows.map((row: any) => ({
        time: row.time,
        crop_name: row.crop_name,
        market_name: row.market_name,
        location: { lat: row.latitude, lng: row.longitude },
        price_per_kg: parseFloat(row.price_per_kg),
        quantity_traded: parseFloat(row.quantity_traded),
      }));
      
      // Cache for 1 hour
      await redisClient.set(
        cacheKey,
        JSON.stringify(prices),
        config.cache.priceTtl
      );
      
      logger.info('Fetched prices from database', {
        crop: crop_name,
        count: prices.length,
      });
      
      return prices;
    } catch (error) {
      logger.error('Error fetching prices', { error, params });
      throw error;
    }
  }
  
  /**
   * Calculate price trends (>2% change for up/down indicators)
   */
  async getPriceTrends(params: PriceQueryParams): Promise<PriceTrend[]> {
    const { crop_name, latitude, longitude, radius_km = 50, limit = 5 } = params;
    
    const cacheKey = `trends:${crop_name}:${latitude}:${longitude}:${radius_km}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      logger.info('Returning cached trends', { cacheKey });
      return JSON.parse(cached);
    }
    
    // Get current and previous day prices
    const query = `
      WITH current_prices AS (
        SELECT 
          crop_name,
          market_name,
          price_per_kg as current_price,
          time
        FROM market_prices
        WHERE crop_name = $1
          AND ST_DWithin(
            location::geography,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
            $4
          )
          AND time >= CURRENT_DATE
        ORDER BY time DESC
      ),
      previous_prices AS (
        SELECT 
          crop_name,
          market_name,
          price_per_kg as previous_price
        FROM market_prices
        WHERE crop_name = $1
          AND ST_DWithin(
            location::geography,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
            $4
          )
          AND time >= CURRENT_DATE - INTERVAL '1 day'
          AND time < CURRENT_DATE
        ORDER BY time DESC
      )
      SELECT 
        c.crop_name,
        c.market_name,
        c.current_price,
        COALESCE(p.previous_price, c.current_price) as previous_price,
        CASE 
          WHEN p.previous_price IS NULL THEN 0
          ELSE ((c.current_price - p.previous_price) / p.previous_price * 100)
        END as change_percentage
      FROM current_prices c
      LEFT JOIN previous_prices p 
        ON c.market_name = p.market_name
      ORDER BY 
        ST_Distance(
          (SELECT location FROM market_prices WHERE market_name = c.market_name LIMIT 1)::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        ) ASC
      LIMIT $5
    `;
    
    const values = [crop_name, longitude, latitude, radius_km * 1000, limit];
    
    try {
      const result = await database.query(query, values);
      
      const trends: PriceTrend[] = result.rows.map((row: any) => {
        const changePercentage = parseFloat(row.change_percentage);
        let trend: 'up' | 'down' | 'stable' = 'stable';
        
        if (changePercentage > 2) {
          trend = 'up';
        } else if (changePercentage < -2) {
          trend = 'down';
        }
        
        return {
          crop_name: row.crop_name,
          market_name: row.market_name,
          current_price: parseFloat(row.current_price),
          previous_price: parseFloat(row.previous_price),
          trend,
          change_percentage: changePercentage,
        };
      });
      
      // Cache for 1 hour
      await redisClient.set(
        cacheKey,
        JSON.stringify(trends),
        config.cache.priceTtl
      );
      
      logger.info('Calculated price trends', {
        crop: crop_name,
        count: trends.length,
      });
      
      return trends;
    } catch (error) {
      logger.error('Error calculating trends', { error, params });
      throw error;
    }
  }
  
  /**
   * Get nearby mandis within radius
   */
  async getNearbyMandis(
    latitude: number,
    longitude: number,
    radius_km: number = 50,
    limit: number = 10
  ): Promise<Array<{ market_name: string; location: { lat: number; lng: number }; distance_km: number }>> {
    const cacheKey = `mandis:${latitude}:${longitude}:${radius_km}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const query = `
      SELECT DISTINCT
        market_name,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude,
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 as distance_km
      FROM market_prices
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY distance_km ASC
      LIMIT $4
    `;
    
    const values = [longitude, latitude, radius_km * 1000, limit];
    
    try {
      const result = await database.query(query, values);
      
      const mandis = result.rows.map((row: any) => ({
        market_name: row.market_name,
        location: { lat: row.latitude, lng: row.longitude },
        distance_km: parseFloat(row.distance_km),
      }));
      
      // Cache for 24 hours (mandis don't change often)
      await redisClient.set(cacheKey, JSON.stringify(mandis), 86400);
      
      return mandis;
    } catch (error) {
      logger.error('Error fetching nearby mandis', { error });
      throw error;
    }
  }
}

export const priceService = new PriceService();
