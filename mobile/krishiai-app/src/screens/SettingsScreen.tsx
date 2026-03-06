/**
 * Settings Screen
 * User settings and manual sync functionality
 * Validates: Requirements 11.4
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSelector, useDispatch} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {MainTabParamList} from '../types/navigation';
import type {RootState} from '../store';
import {getNetworkMonitor} from '../services/networkMonitor';
import {getSyncQueueManager} from '../services/syncQueueManager';
import {startSync, syncComplete, syncFailed} from '../store/slices/syncSlice';

type SettingsScreenProps = NativeStackScreenProps<MainTabParamList, 'Settings'>;

interface SyncProgress {
  itemsSynced: number;
  itemsRemaining: number;
  totalItems: number;
  currentItem?: string;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch();

  // Redux state
  const syncState = useSelector((state: RootState) => state.sync);
  const userName = useSelector((state: RootState) => state.auth.name);
  const language = useSelector((state: RootState) => state.auth.language);

  // Local state
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    itemsSynced: 0,
    itemsRemaining: 0,
    totalItems: 0,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Load sync queue stats
  const loadSyncStats = useCallback(async () => {
    try {
      const syncManager = getSyncQueueManager();
      const stats = await syncManager.getQueueStats();
      setPendingCount(stats.pending);
      setFailedCount(stats.failed);
    } catch (error) {
      console.error('Failed to load sync stats:', error);
    }
  }, []);

  useEffect(() => {
    loadSyncStats();
    const interval = setInterval(loadSyncStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadSyncStats]);

  // Format last sync timestamp
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

  // Handle manual sync
  const handleManualSync = async () => {
    if (!syncState.isOnline) {
      Alert.alert(
        t('sync.noConnection'),
        t('sync.noConnectionMessage'),
        [{text: t('common.ok')}]
      );
      return;
    }

    if (pendingCount === 0) {
      Alert.alert(
        t('sync.noPendingItems'),
        t('sync.noPendingItemsMessage'),
        [{text: t('common.ok')}]
      );
      return;
    }

    try {
      setIsSyncing(true);
      setShowSyncModal(true);
      dispatch(startSync());

      const syncManager = getSyncQueueManager();
      const networkMonitor = getNetworkMonitor();

      // Set up progress callback
      networkMonitor.setSyncProgressCallback((progress) => {
        setSyncProgress(progress);
      });

      // Get initial pending count
      const initialCount = await syncManager.getPendingCount();
      setSyncProgress({
        itemsSynced: 0,
        itemsRemaining: initialCount,
        totalItems: initialCount,
      });

      // Process the queue
      const results = await syncManager.processQueue();

      // Calculate success count
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      console.log(`Manual sync complete: ${successCount} succeeded, ${failedCount} failed`);

      // Update final progress
      setSyncProgress({
        itemsSynced: successCount,
        itemsRemaining: 0,
        totalItems: results.length,
      });

      // Update Redux state
      dispatch(syncComplete());

      // Reload stats
      await loadSyncStats();

      // Show completion message
      setTimeout(() => {
        setShowSyncModal(false);
        Alert.alert(
          t('sync.syncComplete'),
          t('sync.syncCompleteMessage', {
            success: successCount,
            failed: failedCount,
            total: results.length,
          }),
          [{text: t('common.ok')}]
        );
      }, 1000);
    } catch (error: any) {
      console.error('Manual sync failed:', error);
      dispatch(syncFailed());
      setShowSyncModal(false);

      Alert.alert(
        t('sync.syncFailed'),
        error.message || t('sync.syncFailedMessage'),
        [{text: t('common.ok')}]
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle retry failed items
  const handleRetryFailed = async () => {
    if (failedCount === 0) {
      return;
    }

    Alert.alert(
      t('sync.retryFailed'),
      t('sync.retryFailedMessage', {count: failedCount}),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.retry'),
          onPress: async () => {
            try {
              const syncManager = getSyncQueueManager();
              const retriedCount = await syncManager.retryFailedItems();
              await loadSyncStats();

              Alert.alert(
                t('sync.retrySuccess'),
                t('sync.retrySuccessMessage', {count: retriedCount}),
                [{text: t('common.ok')}]
              );
            } catch (error) {
              console.error('Failed to retry items:', error);
              Alert.alert(
                t('common.error'),
                t('sync.retryError'),
                [{text: t('common.ok')}]
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.name')}</Text>
            <Text style={styles.infoValue}>{userName || t('common.farmer')}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.language')}</Text>
            <Text style={styles.infoValue}>
              {language === 'hi' ? 'हिंदी' : language === 'mr' ? 'मराठी' : 'English'}
            </Text>
          </View>
        </View>

        {/* Sync Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.dataSync')}</Text>

          {/* Sync Status Card */}
          <View style={styles.syncCard}>
            <View style={styles.syncHeader}>
              <View style={styles.syncStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    syncState.isOnline ? styles.onlineDot : styles.offlineDot,
                  ]}
                />
                <Text style={styles.syncStatusText}>
                  {syncState.isOnline ? t('sync.online') : t('sync.offline')}
                </Text>
              </View>
              {syncState.lastSyncTimestamp && (
                <Text style={styles.lastSyncText}>
                  {t('sync.lastSync')}: {formatLastSync(syncState.lastSyncTimestamp)}
                </Text>
              )}
            </View>

            {/* Pending Items */}
            <View style={styles.syncStatsRow}>
              <View style={styles.syncStat}>
                <Text style={styles.syncStatValue}>{pendingCount}</Text>
                <Text style={styles.syncStatLabel}>{t('sync.pendingItems')}</Text>
              </View>
              {failedCount > 0 && (
                <View style={styles.syncStat}>
                  <Text style={[styles.syncStatValue, styles.failedValue]}>
                    {failedCount}
                  </Text>
                  <Text style={styles.syncStatLabel}>{t('sync.failed')}</Text>
                </View>
              )}
            </View>

            {/* Sync Now Button */}
            <TouchableOpacity
              style={[
                styles.syncButton,
                (!syncState.isOnline || isSyncing || pendingCount === 0) &&
                  styles.syncButtonDisabled,
              ]}
              onPress={handleManualSync}
              disabled={!syncState.isOnline || isSyncing || pendingCount === 0}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.syncButtonText}>{t('sync.syncNow')}</Text>
                  {pendingCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pendingCount}</Text>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>

            {/* Retry Failed Button */}
            {failedCount > 0 && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryFailed}>
                <Text style={styles.retryButtonText}>
                  {t('sync.retryFailed')} ({failedCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.version')}</Text>
            <Text style={styles.infoValue}>1.0.0 (MVP)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sync Progress Modal */}
      <Modal
        visible={showSyncModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('sync.syncing')}</Text>

            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.progressText}>
                {syncProgress.itemsSynced} / {syncProgress.totalItems}
              </Text>
              <Text style={styles.progressSubtext}>
                {t('sync.itemsSynced')}
              </Text>
            </View>

            {syncProgress.itemsRemaining > 0 && (
              <Text style={styles.remainingText}>
                {syncProgress.itemsRemaining} {t('sync.remaining')}
              </Text>
            )}

            {syncProgress.currentItem && (
              <Text style={styles.currentItemText}>
                {t('sync.currentItem')}: {syncProgress.currentItem}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  syncCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  syncHeader: {
    marginBottom: 16,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#F44336',
  },
  syncStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastSyncText: {
    fontSize: 14,
    color: '#666',
  },
  syncStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  syncStat: {
    alignItems: 'center',
  },
  syncStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  failedValue: {
    color: '#F44336',
  },
  syncStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  syncButton: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  syncButtonDisabled: {
    backgroundColor: '#BDBDBD',
    elevation: 0,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  retryButtonText: {
    color: '#F57C00',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 16,
  },
  progressSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  currentItemText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default SettingsScreen;
