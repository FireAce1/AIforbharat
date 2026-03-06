import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class CachedRecommendation extends Model {
  static table = 'cached_recommendations';

  @field('farm_id') farmId!: string;
  @field('recommendations_data') recommendationsData!: string; // JSON string
  @date('cached_at') cachedAt!: Date;
  @date('expires_at') expiresAt!: Date;
}
