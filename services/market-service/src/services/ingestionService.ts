import axios from 'axios';
import { database } from '../config/database';
import { config } from '../config';
import { logger } from '../utils/logger';

interface PriceData {
  crop_name: string;
  market_name: string;
  latitude: number;
  longitude: number;
  price_per_kg: number;
  quantity_traded?: number;
  date: Date;
  source: string;
}

export class IngestionService {
  /**
   * Fetch price data from Agmarknet API
   */
  async fetchAgmarknetData(): Promise<PriceData[]> {
    try {
      logger.info('Fetching data from Agmarknet API');
      
      const response = await axios.get(config.externalApis.agmarknet.url, {
        params: {
          'api-key': config.externalApis.agmarknet.apiKey,
          format: 'json',
          limit: 10000,
        },
        timeout: 30000,
      });

      if (!response.data || !response.data.records) {
        logger.warn('No records found in Agmarknet response');
        return [];
      }

      const priceData: PriceData[] = response.data.records.map((record: any) => ({
        crop_name: this.normalizeCropName(record.commodity),
        market_name: record.market,
        latitude: parseFloat(record.latitude) || 0,
        longitude: parseFloat(record.longitude) || 0,
        price_per_kg: parseFloat(record.modal_price) || 0,
        quantity_traded: parseFloat(record.arrivals) || undefined,
        date: new Date(record.arrival_date),
        source: 'agmarknet',
      }));

      logger.info(`Fetched ${priceData.length} records from Agmarknet`);
      return priceData.filter(p => p.latitude !== 0 && p.longitude !== 0 && p.price_per_kg > 0);
      
    } catch (error: any) {
      logger.error('Failed to fetch Agmarknet data', { error: error.message });
      return [];
    }
  }

  /**
   * Fetch price data from eNAM API
   */
  async fetchEnamData(): Promise<PriceData[]> {
    try {
      logger.info('Fetching data from eNAM API');
      
      const response = await axios.get(`${config.externalApis.enam.url}/prices`, {
        headers: {
          'Authorization': `Bearer ${config.externalApis.enam.apiKey}`,
        },
        timeout: 30000,
      });

      if (!response.data || !response.data.data) {
        logger.warn('No data found in eNAM response');
        return [];
      }

      const priceData: PriceData[] = response.data.data.map((record: any) => ({
        crop_name: this.normalizeCropName(record.commodity_name),
        market_name: record.mandi_name,
        latitude: parseFloat(record.lat) || 0,
        longitude: parseFloat(record.lng) || 0,
        price_per_kg: parseFloat(record.modal_price) || 0,
        quantity_traded: parseFloat(record.quantity) || undefined,
        date: new Date(record.price_date),
        source: 'enam',
      }));

      logger.info(`Fetched ${priceData.length} records from eNAM`);
      return priceData.filter(p => p.latitude !== 0 && p.longitude !== 0 && p.price_per_kg > 0);
      
    } catch (error: any) {
      logger.error('Failed to fetch eNAM data', { error: error.message });
      return [];
    }
  }

  /**
   * Store price data in TimescaleDB
   */
  async storePriceData(priceData: PriceData[]): Promise<number> {
    if (priceData.length === 0) {
      logger.info('No price data to store');
      return 0;
    }

    const client = await database.getClient();
    let storedCount = 0;

    try {
      await client.query('BEGIN');

      for (const data of priceData) {
        try {
          await client.query(
            `INSERT INTO market_prices 
             (time, crop_name, market_name, location, price_per_kg, quantity_traded, source)
             VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8)
             ON CONFLICT (time, crop_name, market_name) DO UPDATE
             SET price_per_kg = EXCLUDED.price_per_kg,
                 quantity_traded = EXCLUDED.quantity_traded`,
            [
              data.date,
              data.crop_name,
              data.market_name,
              data.longitude,
              data.latitude,
              data.price_per_kg,
              data.quantity_traded,
              data.source,
            ]
          );
          storedCount++;
        } catch (error: any) {
          logger.warn('Failed to store individual price record', {
            crop: data.crop_name,
            market: data.market_name,
            error: error.message,
          });
        }
      }

      await client.query('COMMIT');
      logger.info(`Successfully stored ${storedCount} price records`);
      
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to store price data', { error: error.message });
      throw error;
    } finally {
      client.release();
    }

    return storedCount;
  }

  /**
   * Run complete data ingestion pipeline
   */
  async ingestPriceData(): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting price data ingestion');

    try {
      // Fetch data from multiple sources in parallel
      const [agmarknetData, enamData] = await Promise.all([
        this.fetchAgmarknetData(),
        this.fetchEnamData(),
      ]);

      // Combine and deduplicate data
      const allData = [...agmarknetData, ...enamData];
      const uniqueData = this.deduplicateData(allData);

      // Store in database
      const storedCount = await this.storePriceData(uniqueData);

      const duration = Date.now() - startTime;
      logger.info('Price data ingestion completed', {
        totalRecords: uniqueData.length,
        storedRecords: storedCount,
        duration: `${duration}ms`,
      });
      
    } catch (error: any) {
      logger.error('Price data ingestion failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize crop names for consistency
   */
  private normalizeCropName(name: string): string {
    const normalized = name.trim().toLowerCase();
    
    // Map common variations to standard names
    const nameMap: { [key: string]: string } = {
      'paddy': 'rice',
      'tomato': 'tomato',
      'onion': 'onion',
      'potato': 'potato',
      'wheat': 'wheat',
      'cotton': 'cotton',
      'sugarcane': 'sugarcane',
      'maize': 'maize',
      'soybean': 'soybean',
      'groundnut': 'groundnut',
    };

    return nameMap[normalized] || normalized;
  }

  /**
   * Remove duplicate price records
   */
  private deduplicateData(data: PriceData[]): PriceData[] {
    const seen = new Set<string>();
    const unique: PriceData[] = [];

    for (const record of data) {
      const key = `${record.date.toISOString()}_${record.crop_name}_${record.market_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(record);
      }
    }

    return unique;
  }
}

export const ingestionService = new IngestionService();
