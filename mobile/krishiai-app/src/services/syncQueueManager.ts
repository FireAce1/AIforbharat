import {Database, Q} from '@nozbe/watermelondb';
import SyncQueueItem, {SyncPriority, SyncStatus} from '../database/models/SyncQueueItem';
import {apiClient} from './apiClient';
import {getConflictResolver, ConflictData} from './conflictResolver';

/**
 * Priority levels for sync queue items
 * Lower number = higher priority
 */
export const PRIORITY_LEVELS: Record<SyncPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Retry configuration with exponential backoff
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 2000, 4000], // 1s, 2s, 4s
};

/**
 * Interface for adding items to the sync queue
 */
export interface AddToQueueParams {
  action: string;
  entityType: string;
  payload: any;
  priority?: SyncPriority;
}

/**
 * Result of processing a single queue item
 */
export interface ProcessResult {
  success: boolean;
  itemId: string;
  error?: string;
}

/**
 * SyncQueueManager handles offline-first data synchronization
 * 
 * Features:
 * - Priority-based queue processing (CRITICAL → HIGH → MEDIUM → LOW)
 * - Exponential backoff retry logic (1s, 2s, 4s)
 * - Sequential processing to maintain order
 * - Status tracking (PENDING, SYNCING, COMPLETED, FAILED)
 * - Integration with WatermelonDB for persistence
 */
export class SyncQueueManager {
  private database: Database;
  private isProcessing: boolean = false;
  private processingPromise: Promise<void> | null = null;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Add an item to the sync queue
   * 
   * @param params - Item parameters including action, entity type, payload, and priority
   * @returns The created SyncQueueItem
   */
  async addToQueue(params: AddToQueueParams): Promise<SyncQueueItem> {
    const {action, entityType, payload, priority = 'MEDIUM'} = params;

    const item = await this.database.write(async () => {
      return await this.database
        .get<SyncQueueItem>('sync_queue')
        .create(queueItem => {
          queueItem.action = action;
          queueItem.payload = JSON.stringify({
            entityType,
            data: payload,
          });
          queueItem.priority = priority;
          queueItem.status = 'PENDING';
          queueItem.retryCount = 0;
        });
    });

    return item;
  }

  /**
   * Process the sync queue
   * 
   * Processes items sequentially in priority order:
   * 1. Sort by priority (CRITICAL → HIGH → MEDIUM → LOW)
   * 2. Then by created_at (oldest first)
   * 3. Process each item with retry logic
   * 4. Update status accordingly
   * 
   * @returns Array of process results
   */
  async processQueue(): Promise<ProcessResult[]> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('Sync queue is already being processed');
      return [];
    }

    this.isProcessing = true;
    const results: ProcessResult[] = [];

    try {
      // Fetch pending items sorted by priority and creation time
      const pendingItems = await this.getPendingItems();

      if (pendingItems.length === 0) {
        console.log('No pending items in sync queue');
        return results;
      }

      console.log(`Processing ${pendingItems.length} items from sync queue`);

      // Process items sequentially
      for (const item of pendingItems) {
        const result = await this.processItem(item);
        results.push(result);

        // Small delay between items to avoid overwhelming the server
        await this.sleep(100);
      }

      console.log(
        `Sync queue processing complete: ${results.filter(r => r.success).length}/${results.length} successful`,
      );

      return results;
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * Get pending items sorted by priority and creation time
   */
  private async getPendingItems(): Promise<SyncQueueItem[]> {
    const items = await this.database
      .get<SyncQueueItem>('sync_queue')
      .query(Q.where('status', 'PENDING'))
      .fetch();

    // Sort by priority (ascending) then by created_at (ascending)
    return items.sort((a, b) => {
      const priorityDiff = a.priorityOrder - b.priorityOrder;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Process a single queue item with retry logic
   */
  private async processItem(item: SyncQueueItem): Promise<ProcessResult> {
    console.log(`Processing sync item: ${item.id} (${item.action})`);

    try {
      // Update status to SYNCING
      await this.updateItemStatus(item, 'SYNCING');

      // Parse payload
      const payload = item.parsedPayload;
      if (!payload) {
        throw new Error('Invalid payload format');
      }

      // Execute the sync action
      await this.executeSyncAction(item.action, payload);

      // Mark as completed
      await this.updateItemStatus(item, 'COMPLETED');

      console.log(`Successfully synced item: ${item.id}`);

      return {
        success: true,
        itemId: item.id,
      };
    } catch (error: any) {
      console.error(`Failed to sync item ${item.id}:`, error);

      // Check if we should retry
      if (item.retryCount < RETRY_CONFIG.maxAttempts) {
        // Calculate delay for exponential backoff
        const delay = RETRY_CONFIG.delays[item.retryCount] || RETRY_CONFIG.delays[RETRY_CONFIG.delays.length - 1];

        console.log(
          `Retrying item ${item.id} after ${delay}ms (attempt ${item.retryCount + 1}/${RETRY_CONFIG.maxAttempts})`,
        );

        // Wait before retry
        await this.sleep(delay);

        // Increment retry count and reset to PENDING
        await this.database.write(async () => {
          await item.update(queueItem => {
            queueItem.retryCount = item.retryCount + 1;
            queueItem.status = 'PENDING';
          });
        });

        // Retry the item
        return await this.processItem(item);
      } else {
        // Max retries exceeded, mark as FAILED
        await this.updateItemStatus(item, 'FAILED', error.message);

        return {
          success: false,
          itemId: item.id,
          error: error.message,
        };
      }
    }
  }

  /**
   * Execute the sync action by making the appropriate API call
   * 
   * Handles conflict detection and resolution:
   * - For UPDATE operations, checks if server has newer data
   * - Uses conflict resolver with last-write-wins strategy
   * - Logs all conflicts for debugging
   */
  private async executeSyncAction(action: string, payload: any): Promise<void> {
    const {entityType, data} = payload;

    // For UPDATE operations, check for conflicts
    if (action.startsWith('UPDATE_')) {
      await this.handleUpdateWithConflictResolution(action, entityType, data);
      return;
    }

    // Route to appropriate API endpoint based on action
    switch (action) {
      case 'CREATE_DISEASE_DETECTION':
        await apiClient.post('/api/v1/crop/disease/detect', data);
        break;

      case 'CREATE_CROP_RECOMMENDATION':
        await apiClient.post('/api/v1/crop/recommend', data);
        break;

      case 'CREATE_CROP':
        await apiClient.post('/api/v1/crop', data);
        break;

      case 'UPDATE_PROFILE':
        await apiClient.put(`/api/v1/user/${data.userId}`, data.updates);
        break;

      case 'CREATE_PRICE_ALERT':
        await apiClient.post('/api/v1/market/alerts', data);
        break;

      case 'SUBSCRIBE_SCHEME':
        await apiClient.post('/api/v1/schemes/alerts/subscribe', data);
        break;

      default:
        // Generic handling for other actions
        if (action.startsWith('POST_')) {
          const url = action.replace('POST_', '').replace(/_/g, '/');
          await apiClient.post(`/api/v1/${url}`, data);
        } else if (action.startsWith('PUT_')) {
          const url = action.replace('PUT_', '').replace(/_/g, '/');
          await apiClient.put(`/api/v1/${url}`, data);
        } else if (action.startsWith('DELETE_')) {
          const url = action.replace('DELETE_', '').replace(/_/g, '/');
          await apiClient.delete(`/api/v1/${url}`);
        } else {
          throw new Error(`Unknown sync action: ${action}`);
        }
    }
  }

  /**
   * Handle UPDATE operations with conflict detection and resolution
   * 
   * Implements last-write-wins strategy:
   * 1. Fetch current server version
   * 2. Compare timestamps (updated_at)
   * 3. If local newer: push to server
   * 4. If server newer: pull from server and update local
   * 5. Log conflict for debugging
   */
  private async handleUpdateWithConflictResolution(
    action: string,
    entityType: string,
    data: any,
  ): Promise<void> {
    const conflictResolver = getConflictResolver();

    // Determine entity ID and endpoint based on action
    let entityId: string;
    let endpoint: string;
    let localData: any;
    let localUpdatedAt: number;

    switch (action) {
      case 'UPDATE_FARM':
        entityId = data.farmId;
        endpoint = `/api/v1/farm/${entityId}`;
        localData = data.updates;
        localUpdatedAt = data.updates.updated_at || Date.now();
        break;

      case 'UPDATE_CROP':
        entityId = data.cropId;
        endpoint = `/api/v1/crop/${entityId}`;
        localData = data.updates;
        localUpdatedAt = data.updates.updated_at || Date.now();
        break;

      case 'UPDATE_PROFILE':
        entityId = data.userId;
        endpoint = `/api/v1/user/${entityId}`;
        localData = data.updates;
        localUpdatedAt = data.updates.updated_at || Date.now();
        break;

      default:
        // For unknown UPDATE actions, proceed without conflict resolution
        const url = action.replace('UPDATE_', '').replace(/_/g, '/');
        await apiClient.put(`/api/v1/${url}`, data);
        return;
    }

    try {
      // Fetch current server version
      const serverResponse = await apiClient.get(endpoint);
      const serverData = serverResponse.data;
      const serverUpdatedAt = serverData.updated_at || serverData.updatedAt || 0;

      // Check if there's a conflict (both versions have been modified)
      if (serverUpdatedAt > 0 && localUpdatedAt > 0) {
        const conflict: ConflictData = {
          entityType,
          entityId,
          localData,
          serverData,
          localUpdatedAt,
          serverUpdatedAt,
        };

        // Resolve conflict using last-write-wins strategy
        const resolution = await conflictResolver.resolveConflict(conflict);

        if (resolution.shouldPushToServer) {
          // Local version is newer - push to server
          console.log(
            `Conflict resolved: Local version newer for ${entityType}/${entityId}, pushing to server`,
          );
          await apiClient.put(endpoint, localData);
        } else if (resolution.shouldPullFromServer) {
          // Server version is newer - pull from server and update local
          console.log(
            `Conflict resolved: Server version newer for ${entityType}/${entityId}, pulling from server`,
          );
          await this.updateLocalEntity(entityType, entityId, serverData);
        }
      } else {
        // No conflict detected, proceed with normal update
        await apiClient.put(endpoint, localData);
      }
    } catch (error: any) {
      // If server entity doesn't exist (404), create it instead
      if (error.response?.status === 404) {
        console.log(`Entity not found on server, creating: ${entityType}/${entityId}`);
        await apiClient.post(endpoint.replace(`/${entityId}`, ''), {
          ...localData,
          id: entityId,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Update local entity with server data after conflict resolution
   * 
   * Uses database transaction to ensure ACID compliance
   */
  private async updateLocalEntity(
    entityType: string,
    entityId: string,
    serverData: any,
  ): Promise<void> {
    await this.database.write(async () => {
      let collection: any;

      switch (entityType) {
        case 'farm':
          collection = this.database.get('farms');
          break;
        case 'crop':
          collection = this.database.get('crops');
          break;
        case 'user':
          collection = this.database.get('users');
          break;
        default:
          console.warn(`Unknown entity type for local update: ${entityType}`);
          return;
      }

      try {
        const entity = await collection.find(entityId);
        await entity.update((record: any) => {
          Object.keys(serverData).forEach(key => {
            if (key !== 'id' && key !== 'created_at' && record[key] !== undefined) {
              record[key] = serverData[key];
            }
          });
        });
        console.log(`Updated local ${entityType}/${entityId} with server data`);
      } catch (error) {
        console.error(`Failed to update local ${entityType}/${entityId}:`, error);
      }
    });
  }

  /**
   * Update the status of a queue item
   */
  private async updateItemStatus(
    item: SyncQueueItem,
    status: SyncStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.database.write(async () => {
      await item.update(queueItem => {
        queueItem.status = status;
        if (errorMessage) {
          queueItem.errorMessage = errorMessage;
        }
      });
    });
  }

  /**
   * Get the count of pending items in the queue
   */
  async getPendingCount(): Promise<number> {
    const count = await this.database
      .get<SyncQueueItem>('sync_queue')
      .query(Q.where('status', 'PENDING'))
      .fetchCount();

    return count;
  }

  /**
   * Get the count of failed items in the queue
   */
  async getFailedCount(): Promise<number> {
    const count = await this.database
      .get<SyncQueueItem>('sync_queue')
      .query(Q.where('status', 'FAILED'))
      .fetchCount();

    return count;
  }

  /**
   * Get all items with a specific status
   */
  async getItemsByStatus(status: SyncStatus): Promise<SyncQueueItem[]> {
    return await this.database
      .get<SyncQueueItem>('sync_queue')
      .query(Q.where('status', status))
      .fetch();
  }

  /**
   * Retry all failed items by resetting their status to PENDING
   */
  async retryFailedItems(): Promise<number> {
    const failedItems = await this.getItemsByStatus('FAILED');

    let retriedCount = 0;

    await this.database.write(async () => {
      for (const item of failedItems) {
        if (item.canRetry) {
          await item.update(queueItem => {
            queueItem.status = 'PENDING';
            queueItem.errorMessage = undefined;
          });
          retriedCount++;
        }
      }
    });

    console.log(`Reset ${retriedCount} failed items to PENDING status`);

    return retriedCount;
  }

  /**
   * Clear all completed items from the queue
   */
  async clearCompletedItems(): Promise<number> {
    const completedItems = await this.getItemsByStatus('COMPLETED');

    await this.database.write(async () => {
      for (const item of completedItems) {
        await item.markAsDeleted();
      }
    });

    console.log(`Cleared ${completedItems.length} completed items from queue`);

    return completedItems.length;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const [pending, syncing, completed, failed] = await Promise.all([
      this.database
        .get<SyncQueueItem>('sync_queue')
        .query(Q.where('status', 'PENDING'))
        .fetchCount(),
      this.database
        .get<SyncQueueItem>('sync_queue')
        .query(Q.where('status', 'SYNCING'))
        .fetchCount(),
      this.database
        .get<SyncQueueItem>('sync_queue')
        .query(Q.where('status', 'COMPLETED'))
        .fetchCount(),
      this.database
        .get<SyncQueueItem>('sync_queue')
        .query(Q.where('status', 'FAILED'))
        .fetchCount(),
    ]);

    return {
      pending,
      syncing,
      completed,
      failed,
      total: pending + syncing + completed + failed,
    };
  }

  /**
   * Check if queue is currently being processed
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Wait for current processing to complete
   */
  async waitForProcessing(): Promise<void> {
    if (this.processingPromise) {
      await this.processingPromise;
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance (will be initialized with database)
let syncQueueManagerInstance: SyncQueueManager | null = null;

/**
 * Initialize the sync queue manager with database instance
 */
export function initializeSyncQueueManager(database: Database): SyncQueueManager {
  syncQueueManagerInstance = new SyncQueueManager(database);
  return syncQueueManagerInstance;
}

/**
 * Get the sync queue manager instance
 */
export function getSyncQueueManager(): SyncQueueManager {
  if (!syncQueueManagerInstance) {
    throw new Error('SyncQueueManager not initialized. Call initializeSyncQueueManager first.');
  }
  return syncQueueManagerInstance;
}

export default SyncQueueManager;
