import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '../store';
import {fetchIrrigationRequest} from '../store/slices/weatherSlice';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width} = Dimensions.get('window');

const WaterAdvisoryScreen = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {
    irrigationRecommendations,
    irrigationLastUpdated,
    totalWaterSavedMm,
    isLoading,
    error,
  } = useAppSelector(state => state.weather);
  const {farms, selectedFarmId} = useAppSelector(state => state.farm);
  const currentFarm = farms.find(f => f.id === selectedFarmId);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Fetch irrigation recommendations on mount
    if (currentFarm) {
      dispatch(fetchIrrigationRequest());
    }
  }, [dispatch, currentFarm]);

  const handleRefresh = async () => {
    setRefreshing(true);
    dispatch(fetchIrrigationRequest());
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return t('weather.today');
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return t('weather.tomorrow');
    } else {
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      return t('common.justNow');
    } else if (diffHours < 24) {
      return t('common.hoursAgo', {count: diffHours});
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return t('common.daysAgo', {count: diffDays});
    }
  };

  const getTimingIcon = (timing: 'morning' | 'evening') => {
    return timing === 'morning' ? 'wb-sunny' : 'nights-stay';
  };

  const getTimingColor = (timing: 'morning' | 'evening') => {
    return timing === 'morning' ? '#FFA726' : '#5C6BC0';
  };

  if (!currentFarm) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Icon name="water-drop" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>{t('irrigation.noFarmSelected')}</Text>
          <Text style={styles.emptySubtext}>
            {t('irrigation.addFarmToViewAdvisory')}
          </Text>
        </View>
      </View>
    );
  }

  const todayRecommendation = irrigationRecommendations.find(rec => {
    const recDate = new Date(rec.date);
    const today = new Date();
    return recDate.toDateString() === today.toDateString();
  });

  // Calculate water savings chart data
  const chartData = irrigationRecommendations.slice(0, 7).reverse();
  const maxSaved = Math.max(...chartData.map(r => r.waterSavedMm), 50);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('irrigation.waterAdvisory')}</Text>
        {irrigationLastUpdated && (
          <Text style={styles.lastUpdated}>
            {t('irrigation.lastUpdated', {
              time: formatRelativeTime(irrigationLastUpdated),
            })}
          </Text>
        )}
      </View>

      {/* Today's Recommendation */}
      {todayRecommendation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('irrigation.todayRecommendation')}
          </Text>
          <View
            style={[
              styles.recommendationCard,
              todayRecommendation.shouldIrrigate
                ? styles.recommendationCardIrrigate
                : styles.recommendationCardSkip,
            ]}>
            <View style={styles.recommendationHeader}>
              <Icon
                name={
                  todayRecommendation.shouldIrrigate
                    ? 'water-drop'
                    : 'block'
                }
                size={48}
                color={todayRecommendation.shouldIrrigate ? '#2196F3' : '#9E9E9E'}
              />
              <View style={styles.recommendationHeaderText}>
                <Text style={styles.recommendationTitle}>
                  {todayRecommendation.shouldIrrigate
                    ? t('irrigation.irrigateToday')
                    : t('irrigation.skipIrrigation')}
                </Text>
                <Text style={styles.recommendationReason}>
                  {todayRecommendation.reason}
                </Text>
              </View>
            </View>

            {todayRecommendation.shouldIrrigate && (
              <View style={styles.recommendationDetails}>
                <View style={styles.detailRow}>
                  <Icon name="opacity" size={20} color="#2196F3" />
                  <Text style={styles.detailLabel}>
                    {t('irrigation.waterAmount')}:
                  </Text>
                  <Text style={styles.detailValue}>
                    {todayRecommendation.amountMm.toFixed(1)} mm
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Icon
                    name={getTimingIcon(todayRecommendation.timing)}
                    size={20}
                    color={getTimingColor(todayRecommendation.timing)}
                  />
                  <Text style={styles.detailLabel}>
                    {t('irrigation.timing')}:
                  </Text>
                  <Text style={styles.detailValue}>
                    {t(`irrigation.${todayRecommendation.timing}`)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Icon name="savings" size={20} color="#4CAF50" />
                  <Text style={styles.detailLabel}>
                    {t('irrigation.waterSaved')}:
                  </Text>
                  <Text style={styles.detailValue}>
                    {todayRecommendation.waterSavedMm.toFixed(1)} mm
                  </Text>
                </View>
              </View>
            )}

            {!todayRecommendation.shouldIrrigate && (
              <View style={styles.recommendationDetails}>
                <View style={styles.detailRow}>
                  <Icon name="savings" size={20} color="#4CAF50" />
                  <Text style={styles.detailLabel}>
                    {t('irrigation.waterSaved')}:
                  </Text>
                  <Text style={styles.detailValue}>
                    {todayRecommendation.waterSavedMm.toFixed(1)} mm
                  </Text>
                </View>
              </View>
            )}

            {/* Technical Details */}
            <View style={styles.technicalDetails}>
              <Text style={styles.technicalTitle}>
                {t('irrigation.technicalDetails')}
              </Text>
              <View style={styles.technicalRow}>
                <Text style={styles.technicalLabel}>
                  {t('irrigation.cropEvapotranspiration')}:
                </Text>
                <Text style={styles.technicalValue}>
                  {todayRecommendation.etc.toFixed(2)} mm
                </Text>
              </View>
              <View style={styles.technicalRow}>
                <Text style={styles.technicalLabel}>
                  {t('irrigation.effectiveRainfall')}:
                </Text>
                <Text style={styles.technicalValue}>
                  {todayRecommendation.effectiveRainfall.toFixed(2)} mm
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Cumulative Water Savings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('irrigation.cumulativeSavings')}
        </Text>
        <View style={styles.savingsCard}>
          <Icon name="water-drop" size={64} color="#4CAF50" />
          <Text style={styles.savingsAmount}>
            {totalWaterSavedMm.toFixed(1)} mm
          </Text>
          <Text style={styles.savingsLabel}>
            {t('irrigation.totalWaterSaved')}
          </Text>
          <Text style={styles.savingsSubtext}>
            {t('irrigation.vsTraditionalMethod')}
          </Text>
        </View>
      </View>

      {/* Water Savings Chart */}
      {chartData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('irrigation.savingsOverTime')}
          </Text>
          <View style={styles.chart}>
            {chartData.map((rec, index) => (
              <View key={index} style={styles.chartItem}>
                <View style={styles.chartBar}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${(rec.waterSavedMm / maxSaved) * 100}%`,
                        backgroundColor: rec.shouldIrrigate
                          ? '#2196F3'
                          : '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartValue}>
                  {rec.waterSavedMm.toFixed(0)}
                </Text>
                <Text style={styles.chartLabel}>{formatDate(rec.date)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, {backgroundColor: '#2196F3'}]}
              />
              <Text style={styles.legendText}>
                {t('irrigation.irrigated')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, {backgroundColor: '#4CAF50'}]}
              />
              <Text style={styles.legendText}>
                {t('irrigation.skipped')}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Upcoming Recommendations */}
      {irrigationRecommendations.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('irrigation.upcomingRecommendations')}
          </Text>
          {irrigationRecommendations.slice(1, 7).map((rec, index) => (
            <View key={index} style={styles.upcomingCard}>
              <View style={styles.upcomingHeader}>
                <Text style={styles.upcomingDate}>{formatDate(rec.date)}</Text>
                <View style={styles.upcomingStatus}>
                  <Icon
                    name={rec.shouldIrrigate ? 'water-drop' : 'block'}
                    size={16}
                    color={rec.shouldIrrigate ? '#2196F3' : '#9E9E9E'}
                  />
                  <Text
                    style={[
                      styles.upcomingStatusText,
                      {
                        color: rec.shouldIrrigate ? '#2196F3' : '#9E9E9E',
                      },
                    ]}>
                    {rec.shouldIrrigate
                      ? t('irrigation.irrigate')
                      : t('irrigation.skip')}
                  </Text>
                </View>
              </View>
              {rec.shouldIrrigate && (
                <View style={styles.upcomingDetails}>
                  <Text style={styles.upcomingDetail}>
                    {rec.amountMm.toFixed(1)} mm • {t(`irrigation.${rec.timing}`)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#757575',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  recommendationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  recommendationCardIrrigate: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  recommendationCardSkip: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recommendationHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  recommendationReason: {
    fontSize: 14,
    color: '#757575',
  },
  recommendationDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 8,
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  technicalDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  technicalTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  technicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  technicalLabel: {
    fontSize: 12,
    color: '#757575',
  },
  technicalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
  },
  savingsCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  savingsAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
  },
  savingsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },
  savingsSubtext: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 200,
    paddingVertical: 8,
  },
  chartItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  chartBar: {
    width: '100%',
    height: 120,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
  },
  chartValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
  },
  chartLabel: {
    fontSize: 9,
    color: '#757575',
    marginTop: 2,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#757575',
  },
  upcomingCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  upcomingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingStatusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  upcomingDetails: {
    marginTop: 4,
  },
  upcomingDetail: {
    fontSize: 12,
    color: '#757575',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
  },
});

export default WaterAdvisoryScreen;
