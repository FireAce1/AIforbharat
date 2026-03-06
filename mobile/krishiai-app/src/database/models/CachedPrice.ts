import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class CachedPrice extends Model {
  static table = 'cached_prices';

  @field('crop_name') cropName!: string;
  @field('market_name') marketName!: string;
  @field('location_lat') locationLat!: number;
  @field('location_lng') locationLng!: number;
  @field('price_per_kg') pricePerKg!: number;
  @field('quantity_traded') quantityTraded?: number;
  @date('price_date') priceDate!: Date;
  @field('trend') trend?: string; // 'up', 'down', 'stable'
  @date('cached_at') cachedAt!: Date;
  @date('expires_at') expiresAt!: Date;

  // Helper method to check if cache is expired
  get isExpired(): boolean {
    return this.expiresAt.getTime() < Date.now();
  }

  // Helper method to get trend indicator
  get trendIndicator(): string {
    switch (this.trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  }
}
