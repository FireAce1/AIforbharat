import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ActivityIndicator, TouchableOpacity} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../store';
import {useTranslation} from 'react-i18next';
import {getNetworkMonitor} from '../services/networkMonitor';

/**
 * SyncStatusIndicator displays the current sync status
 * 
 * Shows:
 * - Pending items count
 * - Syncing progress
 * - Last sync timestamp
 * - Online/offline status
 * - Manual sync button
 */
const SyncStatusIndicator: React.FC = () => {
  const {t} = useTranslation();
  const syncState = useSelector((state: RootState) => state.sync);
  const [syncProgress, setSyncProgress] = useState({
    itemsSynced: 0,
    itemsRemaining: 0,
    totalItems: 0,
  });

  useEffect(() => {
    // Set up sync progress callback
    try {
      const networkMonitor = getNetworkMonitor();
      networkMonitor.setSyncProgressCallback(progress => {
        setSyncProgress(progress);
      });

      return () => {
        networkMonitor.setSyncProgressCallback(null);
      };
    } catch (error) {
      console.warn('Network monitor not initialized:', error);
    }
  }, []);

  const handleManualSync = async () => {
    try {
      const networkMonitor = getNetworkMonitor();
      await networkMonitor.manualSync();
    } catch (error: any) {
      console.error('Manual sync failed:', error);
      // Could show a toast notification here
    }
  };

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) {
      return t('sync.neverSynced');
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return t('sync.justNow');
    } else if (diffMins < 60) {
      return t('sync.minutesAgo', {count: diffMins});
    } else {
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return t('sync.hoursAgo', {count: diffHours});
      } else {
        const diffDays = Math.floor(diffHours / 24);
        return t('sync.daysAgo', {count: diffDays});
      }
    }
  };

  // Don't show if no pending items and not syncing
  if (syncState.pendingCount === 0 && !syncState.isSyncing) {
    return (
      <View style={styles.container}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, syncState.isOnline ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.statusText}>
            {syncState.isOnline ? t('sync.online') : t('sync.offline')}
          </Text>
          {syncState.lastSyncTimestamp && (
            <Text style={styles.lastSyncText}>
              {t('sync.lastSync')}: {formatLastSync(syncState.lastSyncTimestamp)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, syncState.isOnline ? styles.onlineDot : styles.offlineDot]} />
        <Text style={styles.statusText}>
          {syncState.isOnline ? t('sync.online') : t('sync.offline')}
        </Text>
      </View>

      {syncState.isSyncing ? (
        <View style={styles.syncingRow}>
          <ActivityIndicator size="small" color="#2E7D32" />
          <Text style={styles.syncingText}>
            {t('sync.syncing')}: {syncProgress.itemsSynced}/{syncProgress.totalItems}
          </Text>
          <Text style={styles.remainingText}>
            ({syncProgress.itemsRemaining} {t('sync.remaining')})
          </Text>
        </View>
      ) : (
        <View style={styles.pendingRow}>
          <Text style={styles.pendingText}>
            {syncState.pendingCount} {t('sync.pendingItems')}
          </Text>
          {syncState.failedCount > 0 && (
            <Text style={styles.failedText}>
              {syncState.failedCount} {t('sync.failed')}
            </Text>
          )}
          {syncState.isOnline && (
            <TouchableOpacity style={styles.syncButton} onPress={handleManualSync}>
              <Text style={styles.syncButtonText}>{t('sync.syncNow')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {syncState.lastSyncTimestamp && !syncState.isSyncing && (
        <Text style={styles.lastSyncText}>
          {t('sync.lastSync')}: {formatLastSync(syncState.lastSyncTimestamp)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 14,
    color: '#424242',
    fontWeight: '500',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 'auto',
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  syncingText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 8,
    fontWeight: '500',
  },
  remainingText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pendingText: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  failedText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 12,
    fontWeight: '500',
  },
  syncButton: {
    marginLeft: 'auto',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SyncStatusIndicator;
