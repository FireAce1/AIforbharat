import axios from 'axios';
import { logger } from '../../services/shared/utils/logger';

interface KarnatakaAPMCPrice {
  date: Date;
  apmc_name: string;
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
 * Karnataka APMC (Agricultural Produce Market Committee) API Integration
 * Source: Karnataka APMC (https://apmc.karnataka.gov.in)
 */
export class KarnatakaAPMCAPI {
  private readonly baseUrl = 'https://api.apmc.karnataka.gov.in/v1';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetch current prices from Karnataka APMCs
   */
  async fetchCurrentPrices(district?: string): Promise<KarnatakaAPMCPrice[]> {
    try {
      const params: any = {
        api_key: this.apiKey,
        date: new Date().toISOString().split('T')[0],
      };

      if (district) {
        params.district = district;
      }

      const response = await axios.get(`${this.baseUrl}/prices/today`, {
        params,
        timeout: 10000,
      });

      return this.normalizePrices(response.data.market_prices);
    } catch (error) {
      logger.error('Failed to fetch Karnataka APMC prices:', error);
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
  ): Promise<KarnatakaAPMCPrice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/prices/historical`, {
        params: {
          api_key: this.apiKey,
          commodity: crop,
          from_date: startDate.toISOString().split('T')[0],
          to_date: endDate.toISOString().split('T')[0],
        },
        timeout: 15000,
      });

      return this.normalizePrices(response.data.market_prices);
    } catch (error) {
      logger.error('Failed to fetch Karnataka historical prices:', error);
      throw error;
    }
  }

  /**
   * Get list of all Karnataka APMCs with locations
   */
  async getAPMCList(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/apmcs`, {
        params: {
          api_key: this.apiKey,
        },
        timeout: 10000,
      });

      return response.data.apmcs.map((apmc: any) => ({
        name: apmc.apmc_name,
        district: apmc.district,
        location: {
          latitude: apmc.lat,
          longitude: apmc.lng,
        },
        commodities_traded: apmc.commodities || [],
        contact: apmc.contact_number,
      }));
    } catch (error) {
      logger.error('Failed to fetch Karnataka APMC list:', error);
      throw error;
    }
  }

  /**
   * Normalize price data to standard format
   */
  private normalizePrices(rawPrices: any[]): KarnatakaAPMCPrice[] {
    return rawPrices.map((price) => ({
      date: new Date(price.price_date || price.date),
      apmc_name: price.apmc_name || price.market_name,
      district: price.district,
      crop_name: this.normalizeCropName(price.commodity_name || price.crop),
      variety: price.variety || price.grade || 'General',
      min_price: parseFloat(price.min_price || price.minimum_price),
      max_price: parseFloat(price.max_price || price.maximum_price),
      modal_price: parseFloat(price.modal_price || price.average_price),
      quantity_traded: parseFloat(price.arrivals || price.quantity_quintals || 0),
      location: {
        latitude: price.lat || 0,
        longitude: price.lng || 0,
      },
    }));
  }

  /**
   * Normalize crop names to standard format
   */
  private normalizeCropName(rawName: string): string {
    const cropMapping: { [key: string]: string } = {
      'Ragi': 'ragi',
      'Finger Millet': 'ragi',
      'ರಾಗಿ': 'ragi',
      'Coffee': 'coffee',
      'ಕಾಫಿ': 'coffee',
      'Arabica Coffee': 'coffee_arabica',
      'Robusta Coffee': 'coffee_robusta',
      'Arecanut': 'arecanut',
      'Areca Nut': 'arecanut',
      'ಅಡಿಕೆ': 'arecanut',
      'Paddy': 'paddy',
      'Rice': 'paddy',
      'ಭತ್ತ': 'paddy',
      'Sugarcane': 'sugarcane',
      'ಕಬ್ಬು': 'sugarcane',
      'Mango': 'mango',
      'ಮಾವು': 'mango',
      'Banana': 'banana',
      'ಬಾಳೆ': 'banana',
      'Coconut': 'coconut',
      'ತೆಂಗಿನಕಾಯಿ': 'coconut',
      'Tomato': 'tomato',
      'ಟೊಮೇಟೊ': 'tomato',
      'Onion': 'onion',
      'ಈರುಳ್ಳಿ': 'onion',
    };

    return cropMapping[rawName] || rawName.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Get nearby APMCs within radius (km)
   */
  async getNearbyAPMCs(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/apmcs/nearby`, {
        params: {
          api_key: this.apiKey,
          lat: latitude,
          lng: longitude,
          radius_km: radiusKm,
        },
        timeout: 10000,
      });

      return response.data.apmcs;
    } catch (error) {
      logger.error('Failed to fetch nearby Karnataka APMCs:', error);
      throw error;
    }
  }

  /**
   * Get coffee-specific prices (Karnataka specialty)
   */
  async getCoffeePrices(variety: 'arabica' | 'robusta'): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/prices/coffee`, {
        params: {
          api_key: this.apiKey,
          variety: variety,
          date: new Date().toISOString().split('T')[0],
        },
        timeout: 10000,
      });

      return response.data.coffee_prices;
    } catch (error) {
      logger.error('Failed to fetch Karnataka coffee prices:', error);
      throw error;
    }
  }
}

export default KarnatakaAPMCAPI;
