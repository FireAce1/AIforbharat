import {call, put, select, takeEvery, delay} from 'redux-saga/effects';
import {PayloadAction} from '@reduxjs/toolkit';
import {
  startSync,
  updateSyncItemStatus,
  removeSyncedItem,
  syncComplete,
  syncFailed,
  SyncQueueItem,
} from '../slices/syncSlice';
import {RootState} from '../store';

// Get sync queue from state
const getSyncQueue = (state: RootState) => state.sync.queue;
const getIsOnline = (state: RootState) => state.sync.isOnline;

// Process a single sync item with exponential backoff
function* processSyncItem(item: SyncQueueItem): Generator<any, void, any> {
  try {
    // Update status to syncing
    yield put(updateSyncItemStatus({id: item.id, status: 'SYNCING'}));

    // Calculate exponential backoff delay
    const backoffDelay = Math.pow(2, item.retryCount) * 1000; // 1s, 2s, 4s
    if (item.retryCount > 0) {
      yield delay(backoffDelay);
    }

    // TODO: Implement actual API call based on action type
    // const response = yield call(apiClient[item.action], item.payload);
    
    // Simulate API call for now
    console.log(`Processing sync item: ${item.action}`, item.payload);
    yield delay(500); // Simulate network delay

    // Mark as success and remove from queue
    yield put(updateSyncItemStatus({id: item.id, status: 'SUCCESS'}));
    yield put(removeSyncedItem(item.id));
  } catch (error: any) {
    // Check if we should retry (max 3 attempts)
    if (item.retryCount < 3) {
      yield put(
        updateSyncItemStatus({
          id: item.id,
          status: 'PENDING',
          error: error.message,
        }),
      );
    } else {
      // Mark as failed after 3 attempts
      yield put(
        updateSyncItemStatus({
          id: item.id,
          status: 'FAILED',
          error: error.message || 'Sync failed after 3 attempts',
        }),
      );
    }
  }
}

// Main sync process
function* handleSync(action: PayloadAction<void>): Generator<any, void, any> {
  try {
    // Check if online
    const isOnline: boolean = yield select(getIsOnline);
    if (!isOnline) {
      console.log('Cannot sync: Device is offline');
      yield put(syncFailed());
      return;
    }

    // Get pending items sorted by priority
    const queue: SyncQueueItem[] = yield select(getSyncQueue);
    const pendingItems = queue
      .filter(item => item.status === 'PENDING')
      .sort((a, b) => {
        // Priority order: CRITICAL > HIGH > MEDIUM > LOW
        const priorityOrder = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3};
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      yield put(syncComplete());
      return;
    }

    console.log(`Syncing ${pendingItems.length} items...`);

    // Process each item sequentially
    for (const item of pendingItems) {
      yield call(processSyncItem, item);
    }

    yield put(syncComplete());
  } catch (error: any) {
    console.error('Sync process failed:', error);
    yield put(syncFailed());
  }
}

export function* syncSaga() {
  yield takeEvery(startSync.type, handleSync);
}
