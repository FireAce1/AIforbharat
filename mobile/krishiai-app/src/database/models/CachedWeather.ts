import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class CachedWeather extends Model {
  static table = 'cached_weather';

  @field('location_lat') locationLat!: number;
  @field('location_lng') locationLng!: number;
  @date('forecast_date') forecastDate!: Date;
  @field('temperature') temperature!: number;
  @field('rainfall') rainfall!: number;
  @field('humidity') humidity!: number;
  @field('wind_speed') windSpeed!: number;
  @field('forecast_data') forecastData!: string; // JSON string
  @date('cached_at') cachedAt!: Date;
  @date('expires_at') expiresAt!: Date;

  // Helper method to parse forecast data
  get parsedForecastData(): any {
    try {
      return JSON.parse(this.forecastData);
    } catch {
      return null;
    }
  }

  // Helper method to check if cache is expired
  get isExpired(): boolean {
    return this.expiresAt.getTime() < Date.now();
  }
}
