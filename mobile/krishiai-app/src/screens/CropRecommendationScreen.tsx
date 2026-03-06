/**
 * Crop Recommendation Screen
 * Displays AI-powered crop recommendations with caching
 * Validates: Requirements 4.1-4.5
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSelector, useDispatch} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {MainTabParamList, CropRecommendation} from '../types/navigation';
import type {RootState} from '../store';
import {
  fetchRecommendationsRequest,
  fetchRecommendationsSuccess,
  fetchRecommendationsFailure,
} from '../store/slices/cropSlice';
import {apiClient} from '../services/apiClient';
import {database, Q} from '../database';
import {getNetworkMonitor} from '../services/networkMonitor';
import {startSync} from '../store/slices/syncSlice';

type CropRecommendationScreenProps = NativeStackScreenProps<
  MainTabParamList,
  'CropRecommendation'
>;

const CropRecommendationScreen: React.FC<CropRecommendationScreenProps> = ({
  navigation,
}) => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const [loadingCache, setLoadingCache] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Redux state
  const recommendations = useSelector(
    (state: RootState) => state.crop.recommendations,
  );
  const recommendationsLastUpdated = useSelector(
    (state: RootState) => state.crop.recommendationsLastUpdated,
  );
  const isLoading = useSelector((state: RootState) => state.crop.isLoading);
  const error = useSelector((state: RootState) => state.crop.error);
  const isOnline = useSelector((state: RootState) => state.sync.isOnline);
  const syncState = useSelector((state: RootState) => state.sync);
  const farms = useSelector((state: RootState) => state.farm.farms);

  // Load cached recommendations on mount
  useEffect(() => {
    loadCachedRecommendations();
  }, []);

  /**
   * Load cached recommendations from WatermelonDB
   */
  const loadCachedRecommendations = async () => {
    try {
      setLoadingCache(true);

      if (farms.length === 0) {
        setLoadingCache(false);
        return;
      }

      const farmId = farms[0].id;
      const now = Date.now();

      // Query cached recommendations that haven't expired
      const cachedItems = await database
        .get('cached_recommendations')
        .query(
          Q.where('farm_id', farmId),
          Q.where('expires_at', Q.gt(now)),
          Q.sortBy('cached_at', Q.desc),
          Q.take(1),
        )
        .fetch();

      if (cachedItems.length > 0) {
        const cachedItem = cachedItems[0];
        const recommendationsData = JSON.parse(
          cachedItem.recommendationsData,
        ) as CropRecommendation[];

        // Load into Redux
        dispatch(fetchRecommendationsSuccess(recommendationsData));
      }
    } catch (err) {
      console.error('Error loading cached recommendations:', err);
    } finally {
      setLoadingCache(false);
    }
  };

  /**
   * Fetch recommendations from API
   */
  const fetchRecommendations = async () => {
    if (farms.length === 0) {
      Alert.alert(
        t('errors.error'),
        t('crop.noFarmProfile'),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.navigate('Home'),
          },
        ],
      );
      return;
    }

    dispatch(fetchRecommendationsRequest());

    try {
      const farmId = farms[0].id;

      // Call crop service API
      const response = await apiClient.post('/api/v1/crop/recommend', {
        farmId,
      });

      const recommendationsData = response.data
        .recommendations as CropRecommendation[];

      // Save to Redux
      dispatch(fetchRecommendationsSuccess(recommendationsData));

      // Cache in WatermelonDB with 24-hour expiry
      await cacheRecommendations(farmId, recommendationsData);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);

      const errorMessage =
        err.isOffline
          ? t('errors.networkError')
          : err.response?.data?.message || t('errors.serverError');

      dispatch(fetchRecommendationsFailure(errorMessage));

      if (!err.isOffline) {
        Alert.alert(t('errors.error'), errorMessage);
      }
    }
  };

  /**
   * Cache recommendations in WatermelonDB
   */
  const cacheRecommendations = async (
    farmId: string,
    recommendationsData: CropRecommendation[],
  ) => {
    try {
      await database.write(async () => {
        const now = Date.now();
        const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

        // Delete old cached recommendations for this farm
        const oldCached = await database
          .get('cached_recommendations')
          .query(Q.where('farm_id', farmId))
          .fetch();

        for (const item of oldCached) {
          await item.markAsDeleted();
        }

        // Create new cached recommendation
        await database.get('cached_recommendations').create((record: any) => {
          record.farmId = farmId;
          record.recommendationsData = JSON.stringify(recommendationsData);
          record.cachedAt = new Date(now);
          record.expiresAt = new Date(expiresAt);
        });
      });
    } catch (err) {
      console.error('Error caching recommendations:', err);
    }
  };

  /**
   * Format last updated timestamp
   */
  const formatLastUpdated = () => {
    if (!recommendationsLastUpdated) {
      return '';
    }

    const lastUpdated = new Date(recommendationsLastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return t('common.justNow');
    } else if (diffMins < 60) {
      return `${diffMins} ${t('common.minutesAgo')}`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} ${t('common.hoursAgo')}`;
    }
  };

  /**
   * Get risk level color
   */
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low':
        return '#43A047';
      case 'Medium':
        return '#FB8C00';
      case 'High':
        return '#E53935';
      default:
        return '#666';
    }
  };

  /**
   * Get ranking badge
   */
  const getRankingBadge = (index: number) => {
    const badges = ['🥇', '🥈', '🥉'];
    return badges[index] || '';
  };

  /**
   * Navigate to crop detail screen
   */
  const viewCropDetail = (recommendation: CropRecommendation) => {
    navigation.navigate('CropDetail', {recommendation});
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecommendations();
    if (isOnline && syncState.pendingCount > 0) {
      dispatch(startSync());
    }
    setRefreshing(false);
  }, [isOnline, syncState.pendingCount]);

  // Show loading state while checking cache
  if (loadingCache) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2E7D32']}
            tintColor="#2E7D32"
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('crop.cropRecommendation')}</Text>
          <Text style={styles.subtitle}>
            {t('crop.recommendationSubtitle')}
          </Text>
        </View>

        {/* Get Recommendations Button */}
        {recommendations.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🌾</Text>
            <Text style={styles.emptyText}>
              {t('crop.noRecommendations')}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={fetchRecommendations}
              disabled={!isOnline && farms.length === 0}>
              <Text style={styles.primaryButtonText}>
                {t('crop.getRecommendations')}
              </Text>
            </TouchableOpacity>
            {!isOnline && (
              <Text style={styles.offlineNote}>
                {t('crop.recommendationsRequireOnline')}
              </Text>
            )}
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.analyzingText}>{t('crop.analyzing')}</Text>
            <Text style={styles.analyzingSubtext}>
              {t('crop.analyzingDetails')}
            </Text>
          </View>
        )}

        {/* Recommendations List */}
        {recommendations.length > 0 && !isLoading && (
          <>
            {/* Last Updated Info */}
            <View style={styles.lastUpdatedContainer}>
              <Text style={styles.lastUpdatedText}>
                {isOnline
                  ? `${t('market.lastUpdated').replace('{{time}}', formatLastUpdated())}`
                  : `${t('sync.offlineMode')} • ${t('market.lastUpdated').replace('{{time}}', formatLastUpdated())}`}
              </Text>
              {isOnline && (
                <TouchableOpacity
                  onPress={fetchRecommendations}
                  style={styles.refreshButton}>
                  <Text style={styles.refreshButtonText}>🔄</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Recommendations Cards */}
            <Text style={styles.sectionTitle}>
              {t('crop.topRecommendations').replace('{{count}}', '3')}
            </Text>

            {recommendations.slice(0, 3).map((recommendation, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recommendationCard}
                onPress={() => viewCropDetail(recommendation)}>
                {/* Ranking Badge */}
                <View style={styles.rankingBadge}>
                  <Text style={styles.rankingText}>
                    {getRankingBadge(index)}
                  </Text>
                </View>

                {/* Crop Name */}
                <Text style={styles.cropName}>{recommendation.crop}</Text>

                {/* Confidence Score */}
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>
                    {t('crop.confidence')}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {width: `${recommendation.confidence}%`},
                      ]}
                    />
                  </View>
                  <Text style={styles.confidenceValue}>
                    {Math.round(recommendation.confidence)}%
                  </Text>
                </View>

                {/* Quick Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>
                      {t('crop.expectedYield')}
                    </Text>
                    <Text style={styles.statValue}>
                      {recommendation.expectedYield} t/ha
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('crop.profit')}</Text>
                    <Text style={[styles.statValue, {color: '#43A047'}]}>
                      ₹
                      {Math.round(
                        recommendation.expectedRevenue -
                          recommendation.investmentRequired,
                      ).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('crop.riskLevel')}</Text>
                    <Text
                      style={[
                        styles.statValue,
                        {color: getRiskColor(recommendation.riskLevel)},
                      ]}>
                      {t(`crop.riskLevels.${recommendation.riskLevel.toLowerCase()}`)}
                    </Text>
                  </View>
                </View>

                {/* View Details Arrow */}
                <View style={styles.viewDetailsContainer}>
                  <Text style={styles.viewDetailsText}>
                    {t('schemes.viewDetails')}
                  </Text>
                  <Text style={styles.viewDetailsArrow}>›</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Refresh Button */}
            {isOnline && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={fetchRecommendations}>
                <Text style={styles.secondaryButtonText}>
                  🔄 {t('crop.refreshRecommendations')}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchRecommendations}>
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  offlineNote: {
    marginTop: 16,
    fontSize: 14,
    color: '#F57C00',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  analyzingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32',
  },
  analyzingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  lastUpdatedText: {
    fontSize: 14,
    color: '#2E7D32',
    flex: 1,
  },
  refreshButton: {
    padding: 4,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  rankingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  rankingText: {
    fontSize: 32,
  },
  cropName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 16,
  },
  confidenceContainer: {
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginRight: 4,
  },
  viewDetailsArrow: {
    fontSize: 20,
    color: '#2E7D32',
    fontWeight: '300',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2E7D32',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#E53935',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#E53935',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CropRecommendationScreen;
