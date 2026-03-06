import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export type SyncPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SyncStatus = 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';

export default class SyncQueueItem extends Model {
  static table = 'sync_queue';

  @field('action') action!: string;
  @field('payload') payload!: string; // JSON string
  @field('priority') priority!: SyncPriority;
  @field('status') status!: SyncStatus;
  @field('retry_count') retryCount!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('error_message') errorMessage?: string;

  // Helper method to parse payload
  get parsedPayload(): any {
    try {
      return JSON.parse(this.payload);
    } catch {
      return null;
    }
  }

  // Helper method to check if item should be retried
  get canRetry(): boolean {
    return this.status === 'FAILED' && this.retryCount < 3;
  }

  // Helper method to get priority order (for sorting)
  get priorityOrder(): number {
    const priorityMap: Record<SyncPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return priorityMap[this.priority] ?? 4;
  }
}
