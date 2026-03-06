import NetInfo, {NetInfoState, NetInfoStateType} from '@react-native-community/netinfo';
import {getSyncQueueManager} from './syncQueueManager';
import {store} from '../store/store';
import {setOnlineStatus, startSync, syncComplete, syncFailed} from '../store/slices/syncSlice';

/**
 * Network connection type
 */
export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

/**
 * Network state information
 */
export interface NetworkState {
  isConnected: boolean;
  type: ConnectionType;
  isInternetReachable: boolean | null;
}

/**
 * Sync progress callback
 */
export type SyncProgressCallback = (progress: {
  itemsSynced: number;
  itemsRemaining: number;
  totalItems: number;
}) => void;

/**
 * NetworkMonitor handles network state changes and triggers auto-sync
 * 
 * Features:
 * - Detects network state changes (WiFi, cellular, offline)
 * - Automatically triggers sync when WiFi is connected
 * - Provides network state to the app
 * - Shows sync progress notifications
 * - Updates Redux state with sync status
 */
export class NetworkMonitor {
  private unsubscribe: (() => void) | null = null;
  private currentState: NetworkState = {
    isConnected: false,
    type: 'unknown',
    isInternetReachable: null,
  };
  private syncProgressCallback: SyncProgressCallback | null = null;
  private isSyncing: boolean = false;

  /**
   * Start monitoring network state changes
   */
  start(): void {
    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkStateChange);

    // Get initial network state
    NetInfo.fetch().then(this.handleNetworkStateChange);

    console.log('NetworkMonitor started');
  }

  /**
   * Stop monitoring network state changes
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    console.log('NetworkMonitor stopped');
  }

  /**
   * Handle network state changes
   */
  private handleNetworkStateChange = async (state: NetInfoState): Promise<void> => {
    const previousState = this.currentState;

    // Update current state
    this.currentState = {
      isConnected: state.isConnected ?? false,
      type: this.mapNetInfoType(state.type),
      isInternetReachable: state.isInternetReachable,
    };

    console.log('Network state changed:', {
      isConnected: this.currentState.isConnected,
      type: this.currentState.type,
      isInternetReachable: this.currentState.isInternetReachable,
    });

    // Update Redux state
    store.dispatch(setOnlineStatus(this.currentState.isConnected));

    // Check if we should trigger auto-sync
    const shouldAutoSync = this.shouldTriggerAutoSync(previousState, this.currentState);

    if (shouldAutoSync) {
      console.log('WiFi connected - triggering auto-sync');
      await this.triggerAutoSync();
    }
  };

  /**
   * Map NetInfo connection type to our ConnectionType
   */
  private mapNetInfoType(type: NetInfoStateType): ConnectionType {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }

  /**
   * Determine if auto-sync should be triggered
   * 
   * Auto-sync is triggered when:
   * 1. Connection changes from disconnected to WiFi
   * 2. Connection type changes from cellular to WiFi
   * 3. Internet becomes reachable on WiFi
   */
  private shouldTriggerAutoSync(previous: NetworkState, current: NetworkState): boolean {
    // Not connected or not WiFi - don't sync
    if (!current.isConnected || current.type !== 'wifi') {
      return false;
    }

    // Internet not reachable - don't sync
    if (current.isInternetReachable === false) {
      return false;
    }

    // Already syncing - don't trigger again
    if (this.isSyncing) {
      return false;
    }

    // WiFi just connected (was not connected before)
    if (!previous.isConnected && current.isConnected) {
      return true;
    }

    // Switched from cellular to WiFi
    if (previous.type === 'cellular' && current.type === 'wifi') {
      return true;
    }

    // Internet just became reachable on WiFi
    if (
      current.type === 'wifi' &&
      previous.isInternetReachable === false &&
      current.isInternetReachable === true
    ) {
      return true;
    }

    return false;
  }

  /**
   * Trigger automatic sync
   */
  private async triggerAutoSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping auto-sync');
      return;
    }

    try {
      this.isSyncing = true;

      // Get sync queue manager
      const syncManager = getSyncQueueManager();

      // Get pending count before sync
      const pendingCount = await syncManager.getPendingCount();

      if (pendingCount === 0) {
        console.log('No pending items to sync');
        return;
      }

      console.log(`Starting auto-sync with ${pendingCount} pending items`);

      // Update Redux state
      store.dispatch(startSync());

      // Show sync progress notification
      this.showSyncNotification(0, pendingCount, pendingCount);

      // Process the queue
      const results = await syncManager.processQueue();

      // Calculate success count
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      console.log(`Auto-sync complete: ${successCount} succeeded, ${failedCount} failed`);

      // Update Redux state
      store.dispatch(syncComplete());

      // Show completion notification
      this.showSyncNotification(successCount, 0, results.length);

      // Notify callback if set
      if (this.syncProgressCallback) {
        this.syncProgressCallback({
          itemsSynced: successCount,
          itemsRemaining: 0,
          totalItems: results.length,
        });
      }
    } catch (error) {
      console.error('Auto-sync failed:', error);

      // Update Redux state
      store.dispatch(syncFailed());
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Show sync progress notification
   * 
   * Note: In a real implementation, this would use react-native-push-notification
   * or a similar library to show actual notifications. For now, we just log.
   */
  private showSyncNotification(itemsSynced: number, itemsRemaining: number, totalItems: number): void {
    if (itemsRemaining === 0) {
      // Sync complete
      console.log(`✓ Sync complete: ${itemsSynced}/${totalItems} items synced`);
    } else {
      // Sync in progress
      console.log(`⟳ Syncing: ${itemsSynced}/${totalItems} items (${itemsRemaining} remaining)`);
    }

    // Notify callback if set
    if (this.syncProgressCallback) {
      this.syncProgressCallback({
        itemsSynced,
        itemsRemaining,
        totalItems,
      });
    }
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return {...this.currentState};
  }

  /**
   * Check if currently connected to WiFi
   */
  isWiFiConnected(): boolean {
    return this.currentState.isConnected && this.currentState.type === 'wifi';
  }

  /**
   * Check if currently connected (any type)
   */
  isConnected(): boolean {
    return this.currentState.isConnected;
  }

  /**
   * Check if currently syncing
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Set sync progress callback
   */
  setSyncProgressCallback(callback: SyncProgressCallback | null): void {
    this.syncProgressCallback = callback;
  }

  /**
   * Manually trigger sync (for manual sync button)
   */
  async manualSync(): Promise<void> {
    if (!this.currentState.isConnected) {
      throw new Error('No internet connection');
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    console.log('Manual sync triggered');
    await this.triggerAutoSync();
  }
}

// Export singleton instance
let networkMonitorInstance: NetworkMonitor | null = null;

/**
 * Initialize the network monitor
 */
export function initializeNetworkMonitor(): NetworkMonitor {
  if (!networkMonitorInstance) {
    networkMonitorInstance = new NetworkMonitor();
    networkMonitorInstance.start();
  }
  return networkMonitorInstance;
}

/**
 * Get the network monitor instance
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!networkMonitorInstance) {
    throw new Error('NetworkMonitor not initialized. Call initializeNetworkMonitor first.');
  }
  return networkMonitorInstance;
}

/**
 * Stop the network monitor
 */
export function stopNetworkMonitor(): void {
  if (networkMonitorInstance) {
    networkMonitorInstance.stop();
    networkMonitorInstance = null;
  }
}

export default NetworkMonitor;
