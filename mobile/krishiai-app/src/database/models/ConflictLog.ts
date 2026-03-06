import {Model} from '@nozbe/watermelondb';
import {field, readonly, date} from '@nozbe/watermelondb/decorators';

/**
 * ConflictLog model for tracking sync conflicts
 * 
 * Stores information about data conflicts that occur during synchronization
 * between local and server data, including the resolution strategy used.
 */
export default class ConflictLog extends Model {
  static table = 'conflict_log';

  @field('entity_type') entityType!: string;
  @field('entity_id') entityId!: string;
  @field('local_data') localData!: string;
  @field('server_data') serverData!: string;
  @field('local_updated_at') localUpdatedAt!: number;
  @field('server_updated_at') serverUpdatedAt!: number;
  @field('resolution_strategy') resolutionStrategy!: string;
  @field('resolved_data') resolvedData!: string;
  @field('resolved_at') resolvedAt!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Get parsed local data
   */
  get parsedLocalData(): any {
    try {
      return JSON.parse(this.localData);
    } catch {
      return null;
    }
  }

  /**
   * Get parsed server data
   */
  get parsedServerData(): any {
    try {
      return JSON.parse(this.serverData);
    } catch {
      return null;
    }
  }

  /**
   * Get parsed resolved data
   */
  get parsedResolvedData(): any {
    try {
      return JSON.parse(this.resolvedData);
    } catch {
      return null;
    }
  }

  /**
   * Check if local version was newer
   */
  get wasLocalNewer(): boolean {
    return this.localUpdatedAt > this.serverUpdatedAt;
  }

  /**
   * Check if server version was newer
   */
  get wasServerNewer(): boolean {
    return this.serverUpdatedAt > this.localUpdatedAt;
  }

  /**
   * Get time difference in milliseconds
   */
  get timeDifference(): number {
    return Math.abs(this.localUpdatedAt - this.serverUpdatedAt);
  }
}
