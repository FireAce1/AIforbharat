import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface SyncQueueItem {
  id: string;
  action: string;
  payload: any;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface SyncState {
  queue: SyncQueueItem[];
  isSyncing: boolean;
  lastSyncTimestamp: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
}

const initialState: SyncState = {
  queue: [],
  isSyncing: false,
  lastSyncTimestamp: null,
  syncStatus: 'idle',
  pendingCount: 0,
  failedCount: 0,
  isOnline: true,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    // Add item to sync queue
    addToSyncQueue: (state, action: PayloadAction<Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>>) => {
      const newItem: SyncQueueItem = {
        ...action.payload,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };
      state.queue.push(newItem);
      state.pendingCount = state.queue.filter(item => item.status === 'PENDING').length;
    },

    // Start sync process
    startSync: state => {
      state.isSyncing = true;
      state.syncStatus = 'syncing';
    },

    // Update sync item status
    updateSyncItemStatus: (
      state,
      action: PayloadAction<{
        id: string;
        status: SyncQueueItem['status'];
        error?: string;
      }>,
    ) => {
      const item = state.queue.find(i => i.id === action.payload.id);
      if (item) {
        item.status = action.payload.status;
        if (action.payload.error) {
          item.error = action.payload.error;
        }
        if (action.payload.status === 'SYNCING') {
          item.retryCount += 1;
        }
      }
      state.pendingCount = state.queue.filter(item => item.status === 'PENDING').length;
      state.failedCount = state.queue.filter(item => item.status === 'FAILED').length;
    },

    // Remove synced item from queue
    removeSyncedItem: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(item => item.id !== action.payload);
      state.pendingCount = state.queue.filter(item => item.status === 'PENDING').length;
      state.failedCount = state.queue.filter(item => item.status === 'FAILED').length;
    },

    // Complete sync process
    syncComplete: state => {
      state.isSyncing = false;
      state.syncStatus = 'success';
      state.lastSyncTimestamp = new Date().toISOString();
      // Remove successfully synced items
      state.queue = state.queue.filter(item => item.status !== 'SUCCESS');
      state.pendingCount = state.queue.filter(item => item.status === 'PENDING').length;
      state.failedCount = state.queue.filter(item => item.status === 'FAILED').length;
    },

    // Sync failed
    syncFailed: state => {
      state.isSyncing = false;
      state.syncStatus = 'error';
    },

    // Update online status
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },

    // Retry failed items
    retryFailedItems: state => {
      state.queue.forEach(item => {
        if (item.status === 'FAILED' && item.retryCount < 3) {
          item.status = 'PENDING';
          item.error = undefined;
        }
      });
      state.pendingCount = state.queue.filter(item => item.status === 'PENDING').length;
      state.failedCount = state.queue.filter(item => item.status === 'FAILED').length;
    },

    // Clear all synced items
    clearSyncedItems: state => {
      state.queue = state.queue.filter(
        item => item.status === 'PENDING' || item.status === 'FAILED',
      );
    },

    // Reset sync state
    resetSyncState: state => {
      state.queue = [];
      state.isSyncing = false;
      state.syncStatus = 'idle';
      state.pendingCount = 0;
      state.failedCount = 0;
    },
  },
});

export const {
  addToSyncQueue,
  startSync,
  updateSyncItemStatus,
  removeSyncedItem,
  syncComplete,
  syncFailed,
  setOnlineStatus,
  retryFailedItems,
  clearSyncedItems,
  resetSyncState,
} = syncSlice.actions;

export default syncSlice.reducer;
