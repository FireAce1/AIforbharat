import axios from 'axios';
import { logger } from '../../services/shared/utils/logger';

interface PunjabMandiPrice {
  date: Date;
  mandi_name: string;
  district: string;
  crop_name: string;
  variety: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  quantity_traded: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Punjab Mandi Board API Integration
 * Source: Punjab Mandi Board (https://punjabmandi.gov.in)
 */
export class PunjabMandiAPI {
  private readonly baseUrl = 'https://api.punjabmandi.gov.in/v1';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch current prices from Punjab mandis
   */
  async fetchCurrentPrices(district?: string): Promise<PunjabMandiPrice[]> {
    try {
      const params: any = {
        api_key: this.apiKey,
        date: new Date().toISOString().split('T')[0],
      };

      if (district) {
        params.district = district;
      }

      const response = await axios.get(`${this.baseUrl}/prices/current`, {
        params,
        timeout: 10000,
      });

      return this.normalizePrices(response.data.prices);
    } catch (error) {
      logger.error('Failed to fetch Punjab mandi prices:', error);
      throw error;
    }
  }

  /**
   * Fetch historical prices for forecasting
   */
  async fetchHistoricalPrices(
    crop: string,
    startDate: Date,
    endDate: Date
  ): Promise<PunjabMandiPrice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/prices/historical`, {
        params: {
          api_key: this.apiKey,
          crop: crop,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        },
        timeout: 15000,
      });

      return this.normalizePrices(response.data.prices);
    } catch (error) {
      logger.error('Failed to fetch Punjab historical prices:', error);
      throw error;
    }
  }

  /**
   * Get list of all Punjab mandis with locations
   */
  async getMandiList(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/mandis`, {
        params: {
          api_key: this.apiKey,
        },
        timeout: 10000,
      });

      return response.data.mandis.map((mandi: any) => ({
        name: mandi.name,
        district: mandi.district,
        location: {
          latitude: mandi.latitude,
          longitude: mandi.longitude,
        },
        crops_traded: mandi.crops || [],
      }));
    } catch (error) {
      logger.error('Failed to fetch Punjab mandi list:', error);
      throw error;
    }
  }

  /**
   * Normalize price data to standard format
   */
  private normalizePrices(rawPrices: any[]): PunjabMandiPrice[] {
    return rawPrices.map((price) => ({
      date: new Date(price.date || price.arrival_date),
      mandi_name: price.mandi_name || price.market_name,
      district: price.district,
      crop_name: this.normalizeCropName(price.commodity || price.crop_name),
      variety: price.variety || 'General',
      min_price: parseFloat(price.min_price || price.minimum),
      max_price: parseFloat(price.max_price || price.maximum),
      modal_price: parseFloat(price.modal_price || price.average),
      quantity_traded: parseFloat(price.arrivals || price.quantity || 0),
      location: {
        latitude: price.latitude || 0,
        longitude: price.longitude || 0,
      },
    }));
  }

  /**
   * Normalize crop names to standard format
   */
  private normalizeCropName(rawName: string): string {
    const cropMapping: { [key: string]: string } = {
      'Wheat': 'wheat',
      'Gehun': 'wheat',
      'ਕਣਕ': 'wheat',
      'Paddy': 'paddy',
      'Dhan': 'paddy',
      'ਧਾਨ': 'paddy',
      'Cotton': 'cotton',
      'Kapas': 'cotton',
      'ਕਪਾਹ': 'cotton',
      'Maize': 'maize',
      'Makki': 'maize',
      'ਮੱਕੀ': 'maize',
      'Basmati': 'basmati_rice',
      'Sugarcane': 'sugarcane',
      'Ganna': 'sugarcane',
    };

    return cropMapping[rawName] || rawName.toLowerCase();
  }

  /**
   * Get nearby mandis within radius (km)
   */
  async getNearbyMandis(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/mandis/nearby`, {
        params: {
          api_key: this.apiKey,
          latitude,
          longitude,
          radius: radiusKm,
        },
        timeout: 10000,
      });

      return response.data.mandis;
    } catch (error) {
      logger.error('Failed to fetch nearby Punjab mandis:', error);
      throw error;
    }
  }
}

export default PunjabMandiAPI;
